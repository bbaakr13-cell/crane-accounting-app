export const RECYCLE_BIN_KEY = 'bakr_pro_recycle_bin_v1';
export const RECYCLE_BIN_EVENT = 'bakr-pro-recycle-bin-updated';

export type RecycleBinItem = {
  id: string;
  entityType: string;
  title: string;
  subtitle?: string;
  sourceStorageKey: string;
  payload: unknown;
  originalIndex?: number;
  deletedAt: string;
};

type AddToRecycleBinInput = {
  entityType: string;
  title: string;
  subtitle?: string;
  sourceStorageKey: string;
  payload: unknown;
  originalIndex?: number;
};

function makeId() {
  try {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }
  } catch {}

  return `trash-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function notifyRecycleBinUpdated() {
  try {
    window.dispatchEvent(
      new CustomEvent(RECYCLE_BIN_EVENT)
    );
  } catch {}
}

export function readRecycleBin(): RecycleBinItem[] {
  try {
    const raw = localStorage.getItem(RECYCLE_BIN_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function writeRecycleBin(
  items: RecycleBinItem[]
) {
  localStorage.setItem(
    RECYCLE_BIN_KEY,
    JSON.stringify(items)
  );

  notifyRecycleBinUpdated();
}


function payloadIdentity(value: unknown) {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return '';
  }

  const record = value as Record<string, unknown>;

  const candidates = [
    'id',
    '_id',
    'uuid',
    'key',
    'invoiceNo',
    'invoiceNumber',
    'number',
    'day',
  ];

  for (const field of candidates) {
    const current = record[field];

    if (
      current !== undefined &&
      current !== null &&
      String(current).trim() !== ''
    ) {
      return `${field}:${String(current)}`;
    }
  }

  try {
    return `json:${JSON.stringify(value)}`;
  } catch {
    return '';
  }
}

function isSamePayload(
  a: unknown,
  b: unknown
) {
  const aId = payloadIdentity(a);
  const bId = payloadIdentity(b);

  return Boolean(
    aId &&
    bId &&
    aId === bId
  );
}

function entityTypeFromStorageKey(
  key: string
) {
  const k = key.toLowerCase();

  if (
    k.includes('customer') ||
    k.includes('client') ||
    k.includes('opportun')
  ) {
    return 'العملاء والفرص';
  }

  if (
    k.includes('driver') ||
    k.includes('operator')
  ) {
    return 'السواقين والمشغلين';
  }

  if (
    k.includes('expense')
  ) {
    return 'المصاريف';
  }

  if (
    k.includes('transaction') ||
    k.includes('income')
  ) {
    return 'الحركات المالية';
  }

  if (
    k.includes('equipment') ||
    k.includes('crane') ||
    k.includes('machine')
  ) {
    return 'المعدات';
  }

  if (
    k.includes('trip')
  ) {
    return 'المشاوير';
  }

  if (
    k.includes('partner')
  ) {
    return 'حساب الشركاء';
  }

  if (
    k.includes('invoice') ||
    k.includes('rental') ||
    k.includes('quotation')
  ) {
    return 'الفواتير وعروض السعر';
  }

  if (
    k.includes('monthly')
  ) {
    return 'الحساب الشهري';
  }

  if (
    k.includes('document')
  ) {
    return 'المستندات';
  }

  return 'بيانات التطبيق';
}

function titleFromPayload(
  payload: unknown,
  fallback: string
) {
  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    return fallback;
  }

  const record = payload as Record<string, unknown>;

  const fields = [
    'name',
    'customerName',
    'companyName',
    'clientName',
    'partnerName',
    'driverName',
    'operatorName',
    'equipmentName',
    'equipment',
    'craneName',
    'invoiceNo',
    'invoiceNumber',
    'number',
    'title',
    'description',
    'category',
    'date',
  ];

  for (const field of fields) {
    const value = record[field];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return String(value);
    }
  }

  return fallback;
}

function subtitleFromPayload(
  payload: unknown
) {
  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    return '';
  }

  const record = payload as Record<string, unknown>;

  const values = [
    record.phone,
    record.mobile,
    record.workType,
    record.projectLocation,
    record.city,
    record.location,
    record.equipment,
    record.equipmentName,
    record.driverName,
    record.amount,
    record.date,
  ]
    .filter(
      value =>
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
    )
    .map(String);

  return Array.from(
    new Set(values)
  )
    .slice(0, 3)
    .join(' • ');
}

function shouldTrackStorageKey(
  key: string
) {
  const k = String(key || '')
    .toLowerCase();

  if (
    !k ||
    k === RECYCLE_BIN_KEY.toLowerCase()
  ) {
    return false;
  }

  const excluded = [
    'backup',
    'ai_chat',
    'chat_history',
    'dashboard',
    'theme',
    'setting',
    'app_lock',
    'auth',
    'token',
    'session',
    'speech',
  ];

  if (
    excluded.some(
      word => k.includes(word)
    )
  ) {
    return false;
  }

  const tracked = [
    'customer',
    'client',
    'opportun',
    'driver',
    'operator',
    'expense',
    'transaction',
    'income',
    'equipment',
    'crane',
    'machine',
    'trip',
    'partner',
    'invoice',
    'rental',
    'quotation',
    'monthly',
    'document',
    'job',
  ];

  return tracked.some(
    word => k.includes(word)
  );
}

function archiveAutomatically(
  sourceStorageKey: string,
  payload: unknown,
  originalIndex: number
) {
  addToRecycleBin({
    entityType:
      entityTypeFromStorageKey(
        sourceStorageKey
      ),
    title:
      titleFromPayload(
        payload,
        entityTypeFromStorageKey(
          sourceStorageKey
        )
      ),
    subtitle:
      subtitleFromPayload(
        payload
      ),
    sourceStorageKey,
    payload,
    originalIndex,
  });
}

let autoGuardInstalled = false;

/**
 * يربط عمليات الحذف من بيانات التطبيق المخزنة في localStorage
 * بسلة المحذوفات تلقائياً.
 *
 * لا يغير طريقة الحذف في الصفحات؛ فقط يحتفظ بالعنصر المحذوف
 * قبل أن يختفي من التخزين.
 */
export function installRecycleBinAutoGuard() {
  if (
    autoGuardInstalled ||
    typeof window === 'undefined' ||
    typeof Storage === 'undefined'
  ) {
    return;
  }

  autoGuardInstalled = true;

  const originalGetItem =
    Storage.prototype.getItem;

  const originalSetItem =
    Storage.prototype.setItem;

  const originalRemoveItem =
    Storage.prototype.removeItem;

  Storage.prototype.setItem =
    function (
      key: string,
      value: string
    ) {
      if (
        this !== window.localStorage ||
        !shouldTrackStorageKey(key)
      ) {
        return originalSetItem.call(
          this,
          key,
          value
        );
      }

      let removed: Array<{
        payload: unknown;
        index: number;
      }> = [];

      try {
        const oldRaw =
          originalGetItem.call(
            this,
            key
          );

        if (oldRaw) {
          const oldValue =
            JSON.parse(oldRaw);

          const newValue =
            JSON.parse(value);

          if (
            Array.isArray(oldValue) &&
            Array.isArray(newValue) &&
            newValue.length <
              oldValue.length
          ) {
            removed =
              oldValue
                .map(
                  (
                    payload,
                    index
                  ) => ({
                    payload,
                    index,
                  })
                )
                .filter(
                  ({ payload }) =>
                    !newValue.some(
                      next =>
                        isSamePayload(
                          payload,
                          next
                        )
                    )
                );
          }
        }
      } catch {
        removed = [];
      }

      const result =
        originalSetItem.call(
          this,
          key,
          value
        );

      removed.forEach(
        ({ payload, index }) => {
          archiveAutomatically(
            key,
            payload,
            index
          );
        }
      );

      return result;
    };

  Storage.prototype.removeItem =
    function (
      key: string
    ) {
      if (
        this !== window.localStorage ||
        !shouldTrackStorageKey(key)
      ) {
        return originalRemoveItem.call(
          this,
          key
        );
      }

      let oldValue: unknown = null;

      try {
        const oldRaw =
          originalGetItem.call(
            this,
            key
          );

        oldValue =
          oldRaw
            ? JSON.parse(oldRaw)
            : null;
      } catch {
        oldValue = null;
      }

      const result =
        originalRemoveItem.call(
          this,
          key
        );

      if (
        Array.isArray(oldValue)
      ) {
        oldValue.forEach(
          (payload, index) => {
            archiveAutomatically(
              key,
              payload,
              index
            );
          }
        );
      } else if (
        oldValue &&
        typeof oldValue ===
          'object'
      ) {
        archiveAutomatically(
          key,
          oldValue,
          0
        );
      }

      return result;
    };
}

export function addToRecycleBin(
  input: AddToRecycleBinInput
) {
  const current =
    readRecycleBin();

  const now = Date.now();

  const recentDuplicate =
    current.some(item => {
      if (
        item.sourceStorageKey !==
          input.sourceStorageKey ||
        !isSamePayload(
          item.payload,
          input.payload
        )
      ) {
        return false;
      }

      const deletedAt =
        new Date(
          item.deletedAt
        ).getTime();

      return (
        Number.isFinite(
          deletedAt
        ) &&
        now - deletedAt <
          8000
      );
    });

  if (recentDuplicate) {
    return current.find(
      item =>
        item.sourceStorageKey ===
          input.sourceStorageKey &&
        isSamePayload(
          item.payload,
          input.payload
        )
    )!;
  }

  const item: RecycleBinItem = {
    id: makeId(),
    entityType: input.entityType,
    title:
      input.title ||
      'عنصر محذوف',
    subtitle:
      input.subtitle || '',
    sourceStorageKey:
      input.sourceStorageKey,
    payload: input.payload,
    originalIndex:
      input.originalIndex,
    deletedAt:
      new Date().toISOString(),
  };

  writeRecycleBin([
    item,
    ...current,
  ]);

  return item;
}

export function deleteRecycleItemPermanently(
  id: string
) {
  writeRecycleBin(
    readRecycleBin().filter(
      item => item.id !== id
    )
  );
}

export function emptyRecycleBin() {
  writeRecycleBin([]);
}

export function restoreRecycleItem(
  id: string
): { ok: true } | { ok: false; message: string } {
  const items = readRecycleBin();

  const item = items.find(
    entry => entry.id === id
  );

  if (!item) {
    return {
      ok: false,
      message: 'العنصر غير موجود',
    };
  }

  try {
    const raw = localStorage.getItem(
      item.sourceStorageKey
    );

    let current: unknown = [];

    if (raw) {
      try {
        current = JSON.parse(raw);
      } catch {
        current = [];
      }
    }

    if (Array.isArray(current)) {
      const next = [...current];

      const index =
        typeof item.originalIndex === 'number'
          ? Math.max(
              0,
              Math.min(
                item.originalIndex,
                next.length
              )
            )
          : next.length;

      next.splice(
        index,
        0,
        item.payload
      );

      localStorage.setItem(
        item.sourceStorageKey,
        JSON.stringify(next)
      );
    } else {
      localStorage.setItem(
        item.sourceStorageKey,
        JSON.stringify(item.payload)
      );
    }

    writeRecycleBin(
      items.filter(
        entry => entry.id !== id
      )
    );

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'تعذر استعادة العنصر',
    };
  }
}
