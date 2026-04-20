/**
 * Global VND Formatter Script
 * HTBMMO-SRC - Standardized Vietnamese Currency Inputs
 */

(function () {
    const VND = new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    /**
     * Format a string value to dots-separated currency
     */
    function formatMoneyValue(value) {
        // Remove all non-digits
        let clean = value.replace(/\D/g, "");
        if (clean === "") return "";
        return VND.format(clean);
    }

    /**
     * Handle Input Event
     */
    function handleMoneyInput(e) {
        if (!e.target.classList.contains('money-input')) return;

        // Get current cursor position
        let cursorStart = e.target.selectionStart;
        let oldLength = e.target.value.length;

        // Format value
        let originalValue = e.target.value;
        let formatted = formatMoneyValue(originalValue);

        e.target.value = formatted;

        // Restore cursor position roughly
        let newLength = e.target.value.length;
        let diff = newLength - oldLength;
        e.target.setSelectionRange(cursorStart + diff, cursorStart + diff);
    }

    // Attach listener to document for dynamic support
    document.addEventListener('input', handleMoneyInput);

    // Initial pass for server-rendered values
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.money-input').forEach(input => {
            input.value = formatMoneyValue(input.value);
        });
    });

    /**
     * Helper to unformat before form submission if target is not already handling it
     */
    window.unformatVND = function (string) {
        return string.toString().replace(/\./g, "");
    };

})();
