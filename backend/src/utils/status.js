const STATUS = {
  BORROWED: "borrowed",
  RETURNED: "returned",
  OVERDUE: "overdue",
  RENEWED: "renewed",
};

const ZH_LABEL = {
  [STATUS.BORROWED]: "借阅中",
  [STATUS.RETURNED]: "已归还",
  [STATUS.OVERDUE]: "已逾期",
  [STATUS.RENEWED]: "已续借",
};

const ALIASES = {
  [STATUS.BORROWED]: new Set(["borrowed", "借阅中", "current", "在借"]),
  [STATUS.RETURNED]: new Set(["returned", "已归还", "归还", "已还"]),
  [STATUS.OVERDUE]: new Set(["overdue", "已逾期", "逾期", "逾期归还"]),
  [STATUS.RENEWED]: new Set(["renewed", "已续借", "续借"]),
};

function toCanonical(s) {
  if (!s || typeof s !== "string") return undefined;
  const v = s.trim().toLowerCase();
  for (const key of Object.keys(ALIASES)) {
    if (ALIASES[key].has(v)) return key;
  }
  return undefined;
}

function toZh(canonical) {
  return ZH_LABEL[canonical];
}

function compatibleDbValues(canonical) {
  const zh = toZh(canonical);
  if (!zh) return [];
  return [canonical, zh];
}

module.exports = {
  STATUS,
  toCanonical,
  toZh,
  compatibleDbValues,
};
