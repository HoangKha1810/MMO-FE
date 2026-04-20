<?php
declare(strict_types=1);

error_reporting(0);
ini_set('display_errors', '0');

require_once __DIR__ . '/../autoload.php';
require_once __DIR__ . '/../includes/enhanced_logger.php';

use App\Core\Database;

// Enhanced webhook logging
$requestId = uniqid('webhook_');
$startTime = microtime(true);
$ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'N/A';
$contentType = $_SERVER['CONTENT_TYPE'] ?? 'N/A';

$data = $_POST;
$requestBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? $_SERVER['HTTP_SIGNATURE'] ?? 'N/A';

// Log incoming webhook with enhanced details
EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'INFO', [
    'request_id' => $requestId,
    'ip' => $ip,
    'user_agent' => $userAgent,
    'content_type' => $contentType,
    'signature' => $signature,
    'raw_body' => $requestBody,
    'content_length' => strlen($requestBody)
]);

if (empty($data)) {
    EnhancedLogger::logWebhook('Gachthe1s_Card', [], 'ERROR', [
        'request_id' => $requestId,
        'error' => 'EMPTY_DATA',
        'ip' => $ip,
        'response_time' => microtime(true) - $startTime
    ]);
    http_response_code(400);
    exit("EMPTY_DATA");
}

$callbackRequestId = $data['request_id'] ?? '';
$status = isset($data['status']) ? (int) $data['status'] : -1;
$callbackSign = $data['callback_sign'] ?? '';
$amount = (float) ($data['amount'] ?? 0);
$declaredValue = (int) ($data['value'] ?? 0);

if (!$callbackRequestId) {
    EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'ERROR', [
        'request_id' => $requestId,
        'error' => 'MISSING_REQUEST_ID',
        'ip' => $ip,
        'response_time' => microtime(true) - $startTime
    ]);
    exit("MISSING_REQUEST_ID");
}

$db = Database::getInstance();

$stmt = $db->prepare("SELECT * FROM card_orders WHERE request_id = ? LIMIT 1");
$stmt->execute([$callbackRequestId]);
$order = $stmt->fetch();

if (!$order) {
    EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'ERROR', [
        'request_id' => $requestId,
        'callback_request_id' => $callbackRequestId,
        'error' => 'NOT_FOUND',
        'ip' => $ip,
        'response_time' => microtime(true) - $startTime
    ]);
    exit("NOT_FOUND");
}

$partnerKey = getSetting('gachthe1s_partner_key');
if (empty($partnerKey)) {
    EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'ERROR', [
        'request_id' => $requestId,
        'callback_request_id' => $callbackRequestId,
        'error' => 'MISSING_PARTNER_KEY',
        'ip' => $ip,
        'response_time' => microtime(true) - $startTime
    ]);
    http_response_code(403);
    exit("MISSING_PARTNER_KEY");
}

$pin = $data['pin'] ?? $order['pin'] ?? '';
$serial = $data['serial'] ?? $order['serial'] ?? '';
$checkSign = md5($partnerKey . $pin . $serial);

if (!hash_equals((string) $checkSign, (string) $callbackSign)) {
    EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'ERROR', [
        'request_id' => $requestId,
        'callback_request_id' => $callbackRequestId,
        'error' => 'INVALID_SIGNATURE',
        'expected_signature' => $checkSign,
        'received_signature' => $callbackSign,
        'ip' => $ip,
        'response_time' => microtime(true) - $startTime
    ]);
    http_response_code(403);
    exit("INVALID_SIGNATURE");
}

EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'SUCCESS', [
    'request_id' => $requestId,
    'callback_request_id' => $callbackRequestId,
    'status' => 'SIGNATURE_VERIFIED',
    'ip' => $ip,
    'response_time' => microtime(true) - $startTime
]);

// 5. Process Update
if ($order['status'] !== 'pending') {
    exit("ALREADY_PROCESSED");
}

try {
    $db->beginTransaction();

    if ($status === 1) { // Success
        // Update Order Status
        $stmtUpdate = $db->prepare("UPDATE card_orders SET status = 'success', amount = ?, processed_at = NOW() WHERE id = ?");
        $stmtUpdate->execute([$amount, $order['id']]);

        // Credit User Balance
        $stmtUser = $db->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
        $stmtUser->execute([$amount, $order['user_id']]);

        // Insert Cashflow Transaction
        $stmtTrx = $db->prepare("INSERT INTO transactions (user_id, amount, type, status, content) VALUES (?, ?, 'deposit', 'success', ?)");
        $stmtTrx->execute([
            $order['user_id'],
            $amount,
            "Gạch thẻ thành công: " . $order['telco'] . " " . number_format($declaredValue) . "đ (Ref: " . $callbackRequestId . ")"
        ]);

        logActivity($db, (int) $order['user_id'], "Nạp tiền thẻ cào thành công: +" . number_format($amount) . "đ (Yêu cầu: $callbackRequestId)");

        EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'SUCCESS', [
            'request_id' => $requestId,
            'callback_request_id' => $callbackRequestId,
            'status' => 'CARD_SUCCESS',
            'user_id' => $order['user_id'],
            'amount' => $amount,
            'telco' => $order['telco'],
            'value' => $declaredValue,
            'ip' => $ip,
            'response_time' => microtime(true) - $startTime
        ]);

        // Notify via Discord (if exists)
        if (function_exists('notifyDiscordCard')) {
            notifyDiscordCard([
                'username' => 'User#' . $order['user_id'],
                'type' => 'exchange',
                'telco' => $order['telco'],
                'value' => $declaredValue,
                'status' => 'success',
                'status_text' => 'Hoàn thành'
            ]);
        }

    } elseif ($status === 2 || $status === 3 || $status === 4) { // Failed / Wrong Value / Cancelled
        $newStatus = ($status === 2) ? 'wrong_value' : 'failed';
        $stmtUpdate = $db->prepare("UPDATE card_orders SET status = ?, processed_at = NOW() WHERE id = ?");
        $stmtUpdate->execute([$newStatus, $order['id']]);

        logActivity($db, (int) $order['user_id'], "Gạch thẻ thất bại: " . $order['telco'] . " - " . number_format($declaredValue) . "đ (Trạng thái: $status)");

        EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'WARNING', [
            'request_id' => $requestId,
            'callback_request_id' => $callbackRequestId,
            'status' => 'CARD_FAILED',
            'failure_reason' => $newStatus,
            'original_status' => $status,
            'user_id' => $order['user_id'],
            'telco' => $order['telco'],
            'value' => $declaredValue,
            'ip' => $ip,
            'response_time' => microtime(true) - $startTime
        ]);
    }

    $db->commit();
    
    EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'SUCCESS', [
        'request_id' => $requestId,
        'callback_request_id' => $callbackRequestId,
        'status' => 'WEBHOOK_PROCESSED',
        'final_status' => $status === 1 ? 'SUCCESS' : 'FAILED',
        'ip' => $ip,
        'total_response_time' => microtime(true) - $startTime
    ]);
    
    echo "OK"; // Respond to GachThe1S
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    
    EnhancedLogger::logWebhook('Gachthe1s_Card', $data, 'ERROR', [
        'request_id' => $requestId,
        'callback_request_id' => $callbackRequestId,
        'error' => 'DATABASE_ERROR',
        'exception_message' => $e->getMessage(),
        'exception_trace' => $e->getTraceAsString(),
        'ip' => $ip,
        'response_time' => microtime(true) - $startTime
    ]);
    
    http_response_code(500);
    echo "SERVER_ERROR";
}
