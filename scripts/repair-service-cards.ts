import { db } from '../src/lib/db';
import {
  getLegacyAllServiceControls,
  invalidateLegacySettingsCache,
} from '../src/lib/legacy-settings';

async function upsertSetting(settingKey: string, settingValue: string) {
  const updated = await db.settings.updateMany({
    where: { setting_key: settingKey },
    data: {
      setting_value: settingValue,
      updated_at: new Date(),
    },
  });

  if (updated.count === 0) {
    await db.settings.create({
      data: {
        setting_key: settingKey,
        setting_value: settingValue,
        updated_at: new Date(),
      },
    });
  }
}

async function main() {
  const apply = process.env.APPLY_SERVICE_CARD_REPAIR === '1';
  const controls = getLegacyAllServiceControls();
  const updates = controls.flatMap((control) => [
    { key: control.nameKey, value: control.defaultTitle },
    { key: control.descKey, value: control.defaultDesc },
  ]);

  console.log(`${apply ? 'Applying' : 'Dry run'} ${updates.length} service card setting repairs`);

  for (const item of updates) {
    console.log(`${item.key} = ${item.value}`);
    if (apply) {
      await upsertSetting(item.key, item.value);
    }
  }

  if (apply) {
    invalidateLegacySettingsCache();
    console.log('Service card settings repaired.');
  } else {
    console.log('Dry run only. Run with APPLY_SERVICE_CARD_REPAIR=1 to update DB.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
