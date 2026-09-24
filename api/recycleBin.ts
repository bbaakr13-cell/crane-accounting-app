export const RECYCLE_BIN_STORAGE_KEY = 'bakr_pro_recycle_bin_v1';
export const RECYCLE_BIN_UPDATED_EVENT = 'bakr-pro-recycle-bin-updated';

export type RecycleBinItem = {
  id: string;
  entityType: string;
  title: string;
  subtitle?: string;
  sourceStorageKey: string;
  originalIndex?: number;
  payload: any;
  deletedAt: string;
  expiresAt?: string;
};

export type MoveToRecycleBinInput = {
  entityType: string;
  title: string;
  subtitle?: string;
  sourceStorageKey: string;
  payload: any;
  originalIndex?: number;
  retentionDays?: number;
};

function makeId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `trash-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function emitUpdated() {
  try {
    window.dispatchEvent(
      new CustomEvent(RECYCLE_BIN_UPDATED_EVENT)
    );
  } catch {}
}

function safeParse(raw: string | null) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getRecycleBinItems(): RecycleBinItem[] {
  try {
    const raw = localStorage.getItem(
      RECYCLE_BIN_STORAGE_KEY
    );

    const parsed = safeParse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is RecycleBinItem =>
          Boolean(
            item &&
              typeof item === 'object' &&
              item.id &&
              item.sourceStorageKey
          )
      )
      .sort((a, b) =>
        String(b.deletedAt).localeCompare(
          String(a.deletedAt)
        )
      );
  } catch {
    return [];
  }
}

export function saveRecycleBinItems(
  items: RecycleBinItem[]
) {
  localStorage.setItem(
    RECYCLE_BIN_STORAGE_KEY,
    JSON.stringify(items)
  );

  emitUpdated();
}

export function moveToRecycleBin(
  input: MoveToRecycleBinInput
) {
  const retentionDays =
    Number.isFinite(input.retentionDays) &&
    Number(input.retentionDays) > 0
      ? Number(input.retentionDays)
      : 30;

  const deletedAt = new Date();
  const expiresAt = new Date(deletedAt);
  expiresAt.setDate(
    expiresAt.getDate() + retentionDays
  );

  const item: RecycleBinItem = {
    id: makeId(),
    entityType: input.entityType,
    title:
      String(input.title || '').trim() ||
      'عنصر محذوف',
    subtitle: String(
      input.subtitle || ''
    ).trim(),
    sourceStorageKey:
      input.sourceStorageKey,
    originalIndex:
      typeof input.originalIndex ===
      'number'
        ? input.originalIndex
        : undefined,
    payload: input.payload,
    deletedAt: deletedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const items = getRecycleBinItems();

  saveRecycleBinItems([
    item,
    ...items,
  ]);

  return item;
}

function sameRecord(
  a: any,
  b: any
) {
  if (!a || !b) return false;

  const aId =
    a.id ??
    a._id ??
    a.uuid ??
    a.key ??
    a.invoiceNumber ??
    a.invoiceNo;

  const bId =
    b.id ??
    b._id ??
    b.uuid ??
    b.key ??
    b.invoiceNumber ??
    b.invoiceNo;

  if (
    aId !== undefined &&
    bId !== undefined
  ) {
    return String(aId) === String(bId);
  }

  try {
    return JSON.stringify(a) ===
      JSON.stringify(b);
  } catch {
    return false;
  }
}

export function restoreRecycleBinItem(
  id: string
) {
  const items = getRecycleBinItems();
  const item = items.find(
    x => x.id === id
  );

  if (!item) {
    return {
      ok: false,
      message:
        'العنصر غير موجود في سلة المحذوفات',
    };
  }

  try {
    const raw = localStorage.getItem(
      item.sourceStorageKey
    );

    const current = safeParse(raw);

    if (
      current === null ||
      current === undefined
    ) {
      localStorage.setItem(
        item.sourceStorageKey,
        JSON.stringify([item.payload])
      );
    } else if (
      Array.isArray(current)
    ) {
      const exists = current.some(
        record =>
          sameRecord(
            record,
            item.payload
          )
      );

      if (!exists) {
        const next = [...current];

        if (
          typeof item.originalIndex ===
            'number' &&
          item.originalIndex >= 0 &&
          item.originalIndex <=
            next.length
        ) {
          next.splice(
            item.originalIndex,
            0,
            item.payload
          );
        } else {
          next.unshift(
            item.payload
          );
        }

        localStorage.setItem(
          item.sourceStorageKey,
          JSON.stringify(next)
        );
      }
    } else {
      localStorage.setItem(
        item.sourceStorageKey,
        JSON.stringify(item.payload)
      );
    }

    saveRecycleBinItems(
      items.filter(
        x => x.id !== id
      )
    );

    try {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: item.sourceStorageKey,
        })
      );
    } catch {}

    return {
      ok: true,
      item,
    };
  } catch (error) {
    console.error(
      'RECYCLE BIN RESTORE ERROR:',
      error
    );

    return {
      ok: false,
      message:
        'تعذر استعادة العنصر',
    };
  }
}

export function deleteRecycleBinItem(
  id: string
) {
  const items = getRecycleBinItems();

  saveRecycleBinItems(
    items.filter(
      item => item.id !== id
    )
  );
}

export function emptyRecycleBin() {
  saveRecycleBinItems([]);
}

export function pruneExpiredRecycleBinItems() {
  const now = Date.now();

  const items = getRecycleBinItems();

  const remaining = items.filter(
    item => {
      if (!item.expiresAt) {
        return true;
      }

      const time = new Date(
        item.expiresAt
      ).getTime();

      if (!Number.isFinite(time)) {
        return true;
      }

      return time > now;
    }
  );

  if (
    remaining.length !==
    items.length
  ) {
    saveRecycleBinItems(
      remaining
    );
  }

  return remaining;
}

export function getRecycleBinDaysLeft(
  item: RecycleBinItem
) {
  if (!item.expiresAt) {
    return null;
  }

  const diff =
    new Date(
      item.expiresAt
    ).getTime() -
    Date.now();

  if (!Number.isFinite(diff)) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil(
      diff /
        (1000 * 60 * 60 * 24)
    )
  );
}
