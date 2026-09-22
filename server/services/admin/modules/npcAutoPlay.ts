import { Storage } from 'serv/services/storage'
import { walletBalanceService } from 'serv/services/walletBalance'
import { TOY_CATALOG } from 'serv/services/game/toys/catalog'
import { adminAccessService, type AdminAccessUser } from './adminAccess'
import { roleGamePermsService, type GameCategory } from './roleGamePerms'
import { buildBgBetPayload } from './npcBgPayload'

export type NpcGameCategory = GameCategory | 'toys'

export type NpcGameItem = {
  category: NpcGameCategory
  key: string
  name: string
  /** 目前是否已支援 NPC 自動遊玩（第一階段僅 bg／retro） */
  supported: boolean
}

export type NpcTimeSlot = {
  id: string
  label: string
  /** 24 小時制，startHour 含頭、endHour 不含尾 */
  startHour: number
  endHour: number
}

/** 24 小時分成 5 個時段，每個 NPC 在「設定」勾選哪幾段允許自動遊玩（見 NpcMemberSetting.activeTimeSlots） */
export const NPC_TIME_SLOTS: NpcTimeSlot[] = [
  { id: 'dawn', label: '凌晨 00:00–06:00', startHour: 0, endHour: 6 },
  { id: 'morning', label: '上午 06:00–10:00', startHour: 6, endHour: 10 },
  { id: 'noon', label: '中午 10:00–14:00', startHour: 10, endHour: 14 },
  { id: 'afternoon', label: '下午 14:00–18:00', startHour: 14, endHour: 18 },
  { id: 'evening', label: '晚上 18:00–24:00', startHour: 18, endHour: 24 }
]

const NPC_TIME_SLOT_IDS = new Set(NPC_TIME_SLOTS.map((s) => s.id))
const ALL_TIME_SLOT_IDS = NPC_TIME_SLOTS.map((s) => s.id)

export type NpcSchedule = {
  /** 排程檢查間隔（秒） */
  tickIntervalSec: number
  /**
   * 經典遊戲模擬分數區間、選經典遊戲／BG 彩票的相對權重、BG 彩票單注金額區間：
   * 全域預設值。個別 NPC 可以在會員設定自訂覆蓋（見 NpcMemberSetting），還沒自訂過的
   * NPC 會即時套用這裡的值（改了全域值，未自訂的 NPC 下一次行動就生效）。
   */
  retroScoreMinPct: number
  retroScoreMaxPct: number
  bgWeight: number
  retroWeight: number
  bgBetAmountMin: number
  bgBetAmountMax: number
}

export type NpcMemberSetting = {
  dailyMaxSpend: number
  topUpAmount: number
  /**
   * 這個 NPC 自訂的經典遊戲模擬分數區間／權重／單注金額區間；還沒存過設定的 NPC
   * 會套用 NpcSchedule 的全域值
   */
  retroScoreMinPct: number
  retroScoreMaxPct: number
  bgWeight: number
  retroWeight: number
  bgBetAmountMin: number
  bgBetAmountMax: number
  /** 這個 NPC 允許自動遊玩的時段，NpcTimeSlot.id 陣列；預設全選（不限時段） */
  activeTimeSlots: string[]
  /** 遊戲頻率：兩次行動至少間隔幾秒 */
  actionIntervalSec: number
  /** 間隔到了之後，有幾 % 機率再加一段隨機延遲（避免每次都固定間隔、太規律） */
  actionJitterChancePct: number
  /** 觸發隨機延遲時，延遲 0~此值之間的隨機秒數 */
  actionJitterMaxSec: number
}

export type NpcGamePreset = {
  id: string
  name: string
  /** composite key `${category}:${key}` 陣列 */
  allowedGames: string[]
  createdAt: number
}

export type NpcMemberRow = {
  id: string
  name: string
  email: string
  coin: number
  dailyMaxSpend: number
  topUpAmount: number
  retroScoreMinPct: number
  retroScoreMaxPct: number
  bgWeight: number
  retroWeight: number
  bgBetAmountMin: number
  bgBetAmountMax: number
  activeTimeSlots: string[]
  actionIntervalSec: number
  actionJitterChancePct: number
  actionJitterMaxSec: number
  spentToday: number
  /** 這位 NPC 目前勾選的遊戲，composite key `${category}:${key}` */
  allowedGames: string[]
}

const SUPPORTED_CATEGORIES = new Set<NpcGameCategory>(['bg', 'retro'])

const DEFAULT_SCHEDULE: NpcSchedule = {
  tickIntervalSec: 30,
  retroScoreMinPct: 10,
  retroScoreMaxPct: 40,
  bgWeight: 75,
  retroWeight: 10,
  bgBetAmountMin: 10,
  bgBetAmountMax: 150
}

const DEFAULT_MEMBER_DAILY_MAX_SPEND = 50_000
const DEFAULT_MEMBER_TOPUP_AMOUNT = 2_000
const DEFAULT_ACTION_INTERVAL_SEC = 20
const DEFAULT_ACTION_JITTER_CHANCE_PCT = 60
const DEFAULT_ACTION_JITTER_MAX_SEC = 30
const AUTO_CREATE_PASSWORD = '222222'
const NPC_EMAIL_DOMAIN = '@npc.hfyy.cc'

/** 自動新增 NPC 會員時，隨機挑 2 個單字組合成名稱的預設單字庫（管理員可在後台調整） */
const DEFAULT_NAME_WORDS = [
  // 原始詞庫
  'Swift', 'Lucky', 'Golden', 'Silver', 'Brave', 'Clever', 'Happy', 'Mighty', 'Rapid', 'Steady',
  'Fox', 'Wolf', 'Tiger', 'Eagle', 'Falcon', 'Panda', 'Dragon', 'Phoenix', 'Raven', 'Shadow',
  // 男性名
  'Abram', 'Adrian', 'Aiden', 'Alan', 'Albert', 'Albie', 'Alby', 'Alden', 'Alexander', 'Alfie',
  'Alonzo', 'Alvin', 'Amir', 'Anthony', 'Archer', 'Aries', 'Arjun', 'Arlo', 'Art', 'Asher',
  'Ashton', 'Atlas', 'Atreus', 'Atticus', 'Aubrey', 'August', 'Avi', 'Axel', 'Axl', 'Azariah',
  'Azrael', 'Bane', 'Banks', 'Barnaby', 'Barrett', 'Bartholomew', 'Bastian', 'Bax', 'Baxter', 'Beau',
  'Beckham', 'Beckett', 'Benicio', 'Benjamin', 'Benji', 'Bennett', 'Benson', 'Benton', 'Bera', 'Billy',
  'Bjorn', 'Blaine', 'Blaise', 'Blake', 'Bobby', 'Boden', 'Bodhi', 'Boone', 'Bora', 'Bowie',
  'Boyd', 'Brad', 'Braden', 'Bradley', 'Brady', 'Braeden', 'Braxton', 'Brayan', 'Brayden', 'Braylen',
  'Braylon', 'Brecken', 'Brennan', 'Brennen', 'Brent', 'Brentley', 'Brett', 'Brexton', 'Brian', 'Brice',
  'Bridger', 'Briggs', 'Brighton', 'Brion', 'Brock', 'Broderick', 'Brodie', 'Brooks', 'Bronson', 'Brooke',
  'Browning', 'Bruce', 'Bryan', 'Brycen', 'Bryer', 'Bryson', 'Buck', 'Caden', 'Caleb', 'Calvin',
  'Charles', 'Christopher', 'Cole', 'Colin', 'Colton', 'Corey', 'Dante', 'David', 'Dean', 'Declan',
  'Dennis', 'Derrick', 'Desmond', 'Devin', 'Donald', 'Douglas', 'Dustin', 'Dylan', 'Elijah', 'Elliot',
  'Emmett', 'Enzo', 'Ethan', 'Eugene', 'Ezra', 'Felix', 'Finley', 'Franklin', 'Gage', 'Garett',
  'Gary', 'Gavin', 'Gideon', 'Gregory', 'Griffin', 'Hector', 'Henry', 'Holden', 'Hudson', 'Isaac',
  'Isaiah', 'Jack', 'Jackson', 'James', 'Jasper', 'Jaxon', 'Jesse', 'Jimmy', 'Joel', 'John',
  'Josue', 'Jude', 'Julian', 'Justin', 'Kaden', 'Kai', 'Kenneth', 'Keith', 'Kian', 'Knox',
  'Lane', 'Lawrence', 'Leo', 'Leon', 'Levi', 'Liam', 'Lincoln', 'Louis', 'Luca', 'Lucas',
  'Luke', 'Luka', 'Lukas', 'Malachi', 'Malie', 'Malik', 'Marco', 'Marcus', 'Mason', 'Mateo',
  'Maverick', 'Max', 'Micah', 'Michael', 'Miles', 'Milo', 'Nathan', 'Nelson', 'Noah', 'Omar',
  'Owen', 'Paul', 'Peter', 'Philip', 'Pierce', 'Preston', 'Quinn', 'Rafael', 'Raymond', 'Reid',
  'Roman', 'Rowan', 'Roy', 'Russell', 'Ryan', 'Samuel', 'Scott', 'Sean', 'Sebastian', 'Seth',
  'Shane', 'Silas', 'Simon', 'Stefan', 'Stephen', 'Theodore', 'Thomas', 'Timothy', 'Travis', 'Tristan',
  'Tyson', 'Victor', 'Walter', 'Warren', 'Waylon', 'Wayne', 'William', 'Wyatt', 'Xander', 'Xavier',
  'Zachary', 'Zane', 'Zion',
  // 女性名
  'Abigail', 'Adalaide', 'Adalee', 'Adaline', 'Adalyn', 'Adalynn', 'Addilyn', 'Addison', 'Addyson', 'Adelaide',
  'Adelay', 'Adele', 'Adelina', 'Adeline', 'Adelyn', 'Adelynn', 'Adira', 'Adley', 'Adriana', 'Adrianna',
  'Adrienne', 'Agatha', 'Agnes', 'Aila', 'Ailani', 'Aileen', 'Ailsa', 'Ainhoa', 'Ainsley', 'Aisha',
  'Aislinn', 'Aitana', 'Aiya', 'Alaina', 'Alana', 'Alani', 'Alanna', 'Alannah', 'Alaya', 'Alayah',
  'Alba', 'Alberte', 'Albertina', 'Aleah', 'Aleena', 'Alejandra', 'Alena', 'Alessandra', 'Alessia', 'Alexa',
  'Alexandra', 'Alexandria', 'Alexia', 'Aleyna', 'Alia', 'Aliana', 'Alianna', 'Alina', 'Alisa', 'Alisha',
  'Alison', 'Alissa', 'Alivia', 'Aliya', 'Aliyah', 'Aliza', 'Alizée', 'Amanda', 'Amara', 'Amelia',
  'Amia', 'Amber', 'Amy', 'Anastasia', 'Angela', 'Ann', 'Anna', 'Anya', 'Aria', 'Aurora',
  'Audrey', 'Aurelia', 'Ava', 'Avery', 'Barbara', 'Beatrice', 'Betty', 'Beverly', 'Blanche', 'Brenda',
  'Brianna', 'Brittany', 'Camila', 'Camille', 'Carol', 'Carolyn', 'Catherine', 'Cecelia', 'Cecilia', 'Celine',
  'Charlotte', 'Cheryl', 'Chloe', 'Christina', 'Christine', 'Cindy', 'Clara', 'Colette', 'Cora', 'Courtney',
  'Cynthia', 'Daphne', 'Danelle', 'Danielle', 'Debra', 'Delilah', 'Denise', 'Destiny', 'Diana', 'Diane',
  'Donna', 'Dorothy', 'Edith', 'Elena', 'Eleanor', 'Eliana', 'Elise', 'Elizabeth', 'Ella', 'Emily',
  'Emilia', 'Emma', 'Erin', 'Eva', 'Evangeline', 'Evelyn', 'Faye', 'Fiona', 'Flora', 'Frances',
  'Freya', 'Genevieve', 'Gemma', 'Gianna', 'Giselle', 'Gloria', 'Grace', 'Hannah', 'Harper', 'Hazel',
  'Heather', 'Helen', 'Helena', 'Iris', 'Isabella', 'Isla', 'Ivy', 'Jane', 'Janet', 'Jasmine',
  'Jean', 'Jennifer', 'Jessica', 'Joan', 'Joyce', 'Judy', 'Juliana', 'Julie', 'Kayla', 'Karen',
  'Katherine', 'Kathleen', 'Kimberly', 'Kylie', 'Laura', 'Lauren', 'Leila', 'Leona', 'Lily', 'Linda',
  'Lisa', 'Lori', 'Lucy', 'Luna', 'Lydia', 'Madelyn', 'Maeve', 'Margaret', 'Maya', 'Mary',
  'Matilda', 'Melissa', 'Megan', 'Mia', 'Michelle', 'Mila', 'Mira', 'Morgan', 'Nicole', 'Naomi',
  'Natalie', 'Nadia', 'Nancy', 'Nova', 'Noelle', 'Ophelia', 'Olivia', 'Paula', 'Pamela', 'Patricia',
  'Pearl', 'Penelope', 'Peyton', 'Phoebe', 'Rachel', 'Rebecca', 'Reese', 'Riley', 'Rosalie', 'Rose',
  'Ruth', 'Samantha', 'Sarah', 'Savannah', 'Scarlett', 'Seraphina', 'Sharon', 'Shirley', 'Shilo', 'Sofia',
  'Sophia', 'Stephanie', 'Stella', 'Susan', 'Sydney', 'Sylvia', 'Talia', 'Tammy', 'Taylor', 'Thea',
  'Theresa', 'Tiffany', 'Valerie', 'Vanessa', 'Vera', 'Victoria', 'Violet', 'Virginia', 'Vivian', 'Willa',
  'Winter', 'Zoe', 'Zoey',
  // 中性名
  'Alex', 'Alexis', 'Alistair', 'Alva', 'Amari', 'Andie', 'Angel', 'Annan', 'Arden', 'Arian',
  'Ariel', 'Arin', 'Arrow', 'Artie', 'Asa', 'Ash', 'Aspen', 'Aston', 'Audie', 'Augustine',
  'Autumn', 'Avon', 'Axil', 'Bailey', 'Bay', 'Bellamy', 'Bennie', 'Bentley', 'Bertie', 'Billi',
  'Billie', 'Blair', 'Blue', 'Bobbie', 'Braelyn', 'Breeze', 'Bria', 'Briar', 'Bright', 'Bryn',
  'Brynn', 'Caelan', 'Callahan', 'Callaway', 'Callen', 'Cameron', 'Campbell', 'Carey', 'Carlin', 'Carlyle',
  'Carmel', 'Carrington', 'Carroll', 'Carsen', 'Carson', 'Carter', 'Cary', 'Casey', 'Channing', 'Charlee',
  'Charlie', 'Chesney', 'Cheyenne', 'Chris', 'Christian', 'Claude', 'Clemente', 'Cleo', 'Clover', 'Codi',
  'Collis', 'Connie', 'Cordell', 'Cortney', 'Cosmo', 'Courtland', 'Crosby', 'Cruz', 'Cyan', 'Cypress',
  'Dakota', 'Dale', 'Dallin', 'Dallas', 'Dana', 'Darian', 'Darrel', 'Daryl', 'Daryn', 'Daveney',
  'Dawson', 'Dayton', 'Denver', 'Eden', 'Ellis', 'Emerson', 'Frankie', 'Francis', 'Frank', 'Gerry',
  'Harlow', 'Hayden', 'Hollis', 'Jamie', 'Jan', 'Jackie', 'Jo', 'Jordan', 'Jules', 'Justice',
  'Kelly', 'Kendall', 'Kerry', 'Kim', 'Legacy', 'Lee', 'Lennon', 'Leslie', 'Logan', 'Lyric',
  'Lynn', 'Marley', 'Mel', 'Milan', 'Monroe', 'Oakley', 'Ocean', 'Ollie', 'Parker', 'Pat',
  'Ray', 'Remi', 'Remington', 'Remy', 'River', 'Robin', 'Rory', 'Sage', 'Sam', 'Sawyer',
  'Scout', 'Shannon', 'Shiloh', 'Sky', 'Skyler', 'Sutton', 'Stevie', 'Teagan', 'Terry', 'Tracy'
]

let _enabled = false
let _schedule: NpcSchedule = { ...DEFAULT_SCHEDULE }
/** 自動新增名稱用的單字庫，見 `generateMemberName()`／`autoCreateMember()` */
let _nameWords: string[] = [...DEFAULT_NAME_WORDS]
/** 每個 NPC 會員各自勾選的遊戲，composite key `${category}:${key}` */
const _allowedGamesByUser = new Map<string, Set<string>>()
const _memberSettings = new Map<string, NpcMemberSetting>()
/** 今日已花費（BG 下注），跨日重置 */
const _dailySpent = new Map<string, { dateKey: string; amount: number }>()
/** 每個 NPC 下次允許行動的時間戳（ms），見 `_isActionDue()`／`_scheduleNextAction()` */
const _nextActionAt = new Map<string, number>()
/** 保存下來的「遊戲勾選」範本，供任一 NPC 快選套用，見 `saveGamePreset()`／`applyGamePreset()` */
const _gamePresets = new Map<string, NpcGamePreset>()
let _gamePresetSeq = 0
let _lastTickAt = 0

function _compositeKey(category: string, key: string): string {
  return `${category}:${key}`
}

/**
 * 隨機挑單字庫裡 2 個不同的單字組合成候選名稱；如果跟現有帳號名稱重複，
 * 後面直接加上遞增數字（2、3、4…）直到不重複為止。
 */
function _generateUniqueMemberName(): string {
  const a = _nameWords[Math.floor(Math.random() * _nameWords.length)] as string
  let b = a
  for (let guard = 0; guard < 20 && b === a && _nameWords.length > 1; guard++) {
    b = _nameWords[Math.floor(Math.random() * _nameWords.length)] as string
  }
  const base = `${a}${b}`
  const existingNames = new Set(adminAccessService.listUsers().map((u) => u.name))
  if (!existingNames.has(base)) return base
  let suffix = 2
  while (existingNames.has(`${base}${suffix}`)) suffix += 1
  return `${base}${suffix}`
}

/**
 * 這個 NPC 第一次被存取時（從沒設定過遊戲勾選），預設全選所有已支援分類（bg／retro）
 * 的遊戲，而不是空清單——之後每次勾選/取消勾選都是在這份清單上增減、正常持久化。
 */
function _allowedGamesOf(userId: string): Set<string> {
  let set = _allowedGamesByUser.get(userId)
  if (!set) {
    set = new Set(
      _fullCatalog()
        .filter((g) => SUPPORTED_CATEGORIES.has(g.category))
        .map((g) => _compositeKey(g.category, g.key))
    )
    _allowedGamesByUser.set(userId, set)
  }
  return set
}

/** 四分類權威清單：bg／retro／tw 重用 roleGamePerms 既有的三分類，toys 另外併進來 */
function _fullCatalog(): Array<{ category: NpcGameCategory; key: string; name: string }> {
  const base = roleGamePermsService.catalog()
  const toys = TOY_CATALOG.map((t) => ({ category: 'toys' as const, key: t.slug, name: t.name }))
  return [...base, ...toys]
}

function _dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function _spentToday(userId: string): number {
  const rec = _dailySpent.get(userId)
  if (!rec || rec.dateKey !== _dateKey()) return 0
  return rec.amount
}

function _addSpent(userId: string, amount: number): void {
  const today = _dateKey()
  const rec = _dailySpent.get(userId)
  if (!rec || rec.dateKey !== today) {
    _dailySpent.set(userId, { dateKey: today, amount })
  } else {
    rec.amount += amount
  }
}

/**
 * 這個 NPC 存過設定（不論存過哪個欄位）就回傳存過的整份設定；從沒存過的話，
 * 權重／單注金額區間即時套用目前的全域排程參數（`_schedule`），每日上限／自動儲值
 * 套用固定預設值——跟全域排程參數無關，本來就只有個別設定這一種來源。
 */
function _memberSettingOf(userId: string): NpcMemberSetting {
  const stored = _memberSettings.get(userId)
  if (stored) return stored
  return {
    dailyMaxSpend: DEFAULT_MEMBER_DAILY_MAX_SPEND,
    topUpAmount: DEFAULT_MEMBER_TOPUP_AMOUNT,
    retroScoreMinPct: _schedule.retroScoreMinPct,
    retroScoreMaxPct: _schedule.retroScoreMaxPct,
    bgWeight: _schedule.bgWeight,
    retroWeight: _schedule.retroWeight,
    bgBetAmountMin: _schedule.bgBetAmountMin,
    bgBetAmountMax: _schedule.bgBetAmountMax,
    activeTimeSlots: [...ALL_TIME_SLOT_IDS],
    actionIntervalSec: DEFAULT_ACTION_INTERVAL_SEC,
    actionJitterChancePct: DEFAULT_ACTION_JITTER_CHANCE_PCT,
    actionJitterMaxSec: DEFAULT_ACTION_JITTER_MAX_SEC
  }
}

/** 這個 NPC 現在（`now`）是否落在它勾選允許遊玩的時段內 */
function _isWithinActiveSlots(userId: string, now: Date): boolean {
  const hour = now.getHours()
  const activeIds = new Set(_memberSettingOf(userId).activeTimeSlots)
  return NPC_TIME_SLOTS.some((slot) => activeIds.has(slot.id) && hour >= slot.startHour && hour < slot.endHour)
}

/** 距離這個 NPC 上次行動是否已經過了它自己的遊戲頻率間隔（含隨機延遲），沒設定過就視為立即可行動 */
function _isActionDue(userId: string, now: number): boolean {
  const dueAt = _nextActionAt.get(userId)
  return dueAt === undefined || now >= dueAt
}

/** 行動後排下一次最早可行動的時間：基本間隔 + 一定機率再加一段隨機延遲，避免太規律 */
function _scheduleNextAction(userId: string, now: number): void {
  const setting = _memberSettingOf(userId)
  const jitterMs = Math.random() * 100 < setting.actionJitterChancePct
    ? Math.random() * setting.actionJitterMaxSec * 1000
    : 0
  _nextActionAt.set(userId, now + setting.actionIntervalSec * 1000 + jitterMs)
}

function _npcUserIds(): string[] {
  return adminAccessService.listUsers()
    .filter((u) => u.role === 'npc')
    .map((u) => u.id)
}

function _allowedKeysOf(userId: string, category: NpcGameCategory): string[] {
  const set = _allowedGamesByUser.get(userId)
  if (!set || set.size === 0) return []
  return _fullCatalog()
    .filter((g) => g.category === category && set.has(_compositeKey(g.category, g.key)))
    .map((g) => g.key)
}

/**
 * 後台：NPC 自動遊玩總開關、全域排程參數（排程間隔、經典遊戲模擬分數區間、
 * 玩法權重／BG 單注金額區間的全域預設值）、四分類遊戲清單（bg/retro 可勾選，tw/toys
 * 標記尚未支援）、每個 NPC 會員各自的設定（每日花費上限、自動儲值金額、玩經典遊戲／
 * BG 彩票的權重、BG 單注金額區間、可勾選的遊戲、允許自動遊玩的時段），排程本體
 * （in-memory，重啟後回復預設值，見 add-npc-auto-play/design.md）。
 *
 * 時段限制：24 小時分成 5 段（見 NPC_TIME_SLOTS），每個 NPC 可複選允許遊玩的時段，
 * 預設全選（不限時段，跟這個功能加入前的行為一致）；`tick()` 每次都先檢查目前時間
 * 是否落在該 NPC 允許的時段內，不在的話這次直接跳過、不行動。
 *
 * 遊戲頻率：每個 NPC 各自有 `actionIntervalSec`（兩次行動至少間隔幾秒）、
 * `actionJitterChancePct`（間隔到了之後，幾 % 機率再加一段隨機延遲）、
 * `actionJitterMaxSec`（該隨機延遲的秒數上限）。每次行動後才重新算下一次最早可行動
 * 的時間點（`_scheduleNextAction()`），時間到之前 `tick()` 會直接跳過這個 NPC，避免
 * 每次心跳（或每次排程檢查）都行動、玩起來太規律像機器人。
 *
 * 權重／單注金額區間採「會員沒設定就抓全域、會員有設定抓會員的」：NPC 只要存過一次
 * 設定（不論改的是哪個欄位），之後就固定用自己存的值，不再跟著全域排程參數變動；
 * 還沒存過任何設定的 NPC 則即時套用目前的全域值（見 `_memberSettingOf()`）。
 *
 * 經濟迴圈：經典遊戲／遊戲中心用模擬分數換 F幣（既有 `game-reward` 結算，純收入，不用
 * 先有錢）；BG 彩票是真的下注扣款（支出），餘額不足時依會員設定自動儲值一筆（留下
 * `admin-topup` 記錄），每日花費達到 `dailyMaxSpend` 後當天不再下注。
 */
export const npcAutoPlayService = {
  isEnabled: (): boolean => _enabled,

  setEnabled: (enabled: boolean): boolean => {
    _enabled = enabled
    return _enabled
  },

  getSchedule: (): NpcSchedule => ({ ..._schedule }),

  updateSchedule: (patch: Partial<NpcSchedule>): NpcSchedule => {
    const next: NpcSchedule = { ..._schedule, ...patch }
    for (const [field, value] of Object.entries(next)) {
      if (!Number.isFinite(value) || (value as number) < 0) {
        throw createError({ statusCode: 400, message: `${field} 必須是不小於 0 的數字。` })
      }
    }
    if (next.tickIntervalSec < 1) {
      throw createError({ statusCode: 400, message: '排程檢查間隔至少要 1 秒。' })
    }
    if (next.retroScoreMinPct > next.retroScoreMaxPct) {
      throw createError({ statusCode: 400, message: '經典遊戲模擬分數下限不可高於上限。' })
    }
    if (next.bgBetAmountMin > next.bgBetAmountMax) {
      throw createError({ statusCode: 400, message: 'BG 彩票單注金額下限不可高於上限。' })
    }
    _schedule = next
    return { ..._schedule }
  },

  listGames: (): NpcGameItem[] =>
    _fullCatalog().map((g) => ({
      ...g,
      supported: SUPPORTED_CATEGORIES.has(g.category)
    })),

  listTimeSlots: (): NpcTimeSlot[] => [...NPC_TIME_SLOTS],

  listNameWords: (): string[] => [..._nameWords],

  /** 設定「自動新增」用的單字庫（整份取代），至少要 2 個單字才能組合出名稱 */
  setNameWords: (words: string[]): string[] => {
    if (!Array.isArray(words)) {
      throw createError({ statusCode: 400, message: '單字清單格式不正確。' })
    }
    const cleaned = [...new Set(words.map((w) => String(w).trim()).filter(Boolean))]
    if (cleaned.length < 2) {
      throw createError({ statusCode: 400, message: '單字庫至少需要 2 個單字才能組合出名稱。' })
    }
    _nameWords = cleaned
    return [..._nameWords]
  },

  /**
   * 自動新增：從單字庫隨機組合出一個不重複的名稱、依同一組合推導 email
   * （`${名稱}@npc.hfyy.cc`），直接建立一個角色為 NPC 的新會員
   */
  autoCreateMember: (): AdminAccessUser => {
    if (_nameWords.length < 2) {
      throw createError({ statusCode: 400, message: '單字庫至少需要 2 個單字才能自動新增，請先到單字庫設定新增。' })
    }
    const name = _generateUniqueMemberName()
    const email = `${name}${NPC_EMAIL_DOMAIN}`
    return adminAccessService.createMember({ name, email, password: AUTO_CREATE_PASSWORD, role: 'npc' })
  },

  setMemberGameAllowed: (userId: string, category: NpcGameCategory, key: string, allowed: boolean): string[] => {
    if (adminAccessService.roleOf(userId) !== 'npc') {
      throw createError({ statusCode: 400, message: '此會員不是 NPC 角色。' })
    }
    const item = _fullCatalog().find((g) => g.category === category && g.key === key)
    if (!item) throw createError({ statusCode: 404, message: '找不到該遊戲。' })
    if (!SUPPORTED_CATEGORIES.has(category)) {
      throw createError({ statusCode: 400, message: '此分類尚未支援 NPC 自動遊玩。' })
    }
    const set = _allowedGamesOf(userId)
    const compositeKey = _compositeKey(category, key)
    if (allowed) set.add(compositeKey)
    else set.delete(compositeKey)
    return [...set]
  },

  /** 快捷選擇：把某個 NPC 在某分類底下、所有已支援的遊戲一次全選或全不選 */
  setMemberGamesBulk: (userId: string, category: NpcGameCategory, allowed: boolean): string[] => {
    if (adminAccessService.roleOf(userId) !== 'npc') {
      throw createError({ statusCode: 400, message: '此會員不是 NPC 角色。' })
    }
    if (!SUPPORTED_CATEGORIES.has(category)) {
      throw createError({ statusCode: 400, message: '此分類尚未支援 NPC 自動遊玩。' })
    }
    const set = _allowedGamesOf(userId)
    const keysInCategory = _fullCatalog()
      .filter((g) => g.category === category)
      .map((g) => _compositeKey(g.category, g.key))
    if (allowed) keysInCategory.forEach((k) => set.add(k))
    else keysInCategory.forEach((k) => set.delete(k))
    return [...set]
  },

  listGamePresets: (): NpcGamePreset[] =>
    [..._gamePresets.values()].sort((a, b) => b.createdAt - a.createdAt),

  /** 把一組遊戲勾選（通常是目前某個 NPC 的 allowedGames）保存成一個可重複套用的命名範本 */
  saveGamePreset: (name: string, allowedGames: string[]): NpcGamePreset => {
    const trimmed = name.trim()
    if (!trimmed) throw createError({ statusCode: 400, message: '請輸入保存的名稱。' })
    if (!Array.isArray(allowedGames)) {
      throw createError({ statusCode: 400, message: '遊戲清單格式不正確。' })
    }
    const validKeys = new Set(
      _fullCatalog()
        .filter((g) => SUPPORTED_CATEGORIES.has(g.category))
        .map((g) => _compositeKey(g.category, g.key))
    )
    const filtered = [...new Set(allowedGames)].filter((k) => validKeys.has(k))
    const id = `preset-${++_gamePresetSeq}`
    const preset: NpcGamePreset = { id, name: trimmed, allowedGames: filtered, createdAt: Date.now() }
    _gamePresets.set(id, preset)
    return preset
  },

  /** 快選：把某個保存範本的遊戲勾選整份套用到指定 NPC，取代它原本的勾選 */
  applyGamePreset: (userId: string, presetId: string): string[] => {
    if (adminAccessService.roleOf(userId) !== 'npc') {
      throw createError({ statusCode: 400, message: '此會員不是 NPC 角色。' })
    }
    const preset = _gamePresets.get(presetId)
    if (!preset) throw createError({ statusCode: 404, message: '找不到這個保存的設定。' })
    const set = _allowedGamesOf(userId)
    set.clear()
    preset.allowedGames.forEach((k) => set.add(k))
    return [...set]
  },

  deleteGamePreset: (presetId: string): void => {
    _gamePresets.delete(presetId)
  },

  listMembers: (): NpcMemberRow[] =>
    adminAccessService.listUsers()
      .filter((u) => u.role === 'npc')
      .map((u) => {
        const setting = _memberSettingOf(u.id)
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          coin: u.coin,
          dailyMaxSpend: setting.dailyMaxSpend,
          topUpAmount: setting.topUpAmount,
          retroScoreMinPct: setting.retroScoreMinPct,
          retroScoreMaxPct: setting.retroScoreMaxPct,
          bgWeight: setting.bgWeight,
          retroWeight: setting.retroWeight,
          bgBetAmountMin: setting.bgBetAmountMin,
          bgBetAmountMax: setting.bgBetAmountMax,
          activeTimeSlots: [...setting.activeTimeSlots],
          actionIntervalSec: setting.actionIntervalSec,
          actionJitterChancePct: setting.actionJitterChancePct,
          actionJitterMaxSec: setting.actionJitterMaxSec,
          spentToday: _spentToday(u.id),
          allowedGames: [..._allowedGamesOf(u.id)]
        }
      }),

  setMemberSetting: (userId: string, patch: {
    dailyMaxSpend?: number
    topUpAmount?: number
    retroScoreMinPct?: number
    retroScoreMaxPct?: number
    bgWeight?: number
    retroWeight?: number
    bgBetAmountMin?: number
    bgBetAmountMax?: number
    activeTimeSlots?: string[]
    actionIntervalSec?: number
    actionJitterChancePct?: number
    actionJitterMaxSec?: number
  }): NpcMemberSetting => {
    if (adminAccessService.roleOf(userId) !== 'npc') {
      throw createError({ statusCode: 400, message: '此會員不是 NPC 角色。' })
    }
    const current = { ..._memberSettingOf(userId) }
    if (patch.dailyMaxSpend !== undefined) {
      if (!Number.isFinite(patch.dailyMaxSpend) || patch.dailyMaxSpend < 0) {
        throw createError({ statusCode: 400, message: '每日花費上限必須是不小於 0 的數字。' })
      }
      current.dailyMaxSpend = patch.dailyMaxSpend
    }
    if (patch.topUpAmount !== undefined) {
      if (!Number.isFinite(patch.topUpAmount) || patch.topUpAmount < 0) {
        throw createError({ statusCode: 400, message: '自動儲值金額必須是不小於 0 的數字。' })
      }
      current.topUpAmount = patch.topUpAmount
    }
    if (patch.retroScoreMinPct !== undefined) {
      if (!Number.isFinite(patch.retroScoreMinPct) || patch.retroScoreMinPct < 0) {
        throw createError({ statusCode: 400, message: '經典遊戲模擬分數下限必須是不小於 0 的數字。' })
      }
      current.retroScoreMinPct = patch.retroScoreMinPct
    }
    if (patch.retroScoreMaxPct !== undefined) {
      if (!Number.isFinite(patch.retroScoreMaxPct) || patch.retroScoreMaxPct < 0) {
        throw createError({ statusCode: 400, message: '經典遊戲模擬分數上限必須是不小於 0 的數字。' })
      }
      current.retroScoreMaxPct = patch.retroScoreMaxPct
    }
    if (patch.bgWeight !== undefined) {
      if (!Number.isFinite(patch.bgWeight) || patch.bgWeight < 0) {
        throw createError({ statusCode: 400, message: 'BG 彩票權重必須是不小於 0 的數字。' })
      }
      current.bgWeight = patch.bgWeight
    }
    if (patch.retroWeight !== undefined) {
      if (!Number.isFinite(patch.retroWeight) || patch.retroWeight < 0) {
        throw createError({ statusCode: 400, message: '經典遊戲權重必須是不小於 0 的數字。' })
      }
      current.retroWeight = patch.retroWeight
    }
    if (patch.bgBetAmountMin !== undefined) {
      if (!Number.isFinite(patch.bgBetAmountMin) || patch.bgBetAmountMin < 0) {
        throw createError({ statusCode: 400, message: 'BG 單注金額下限必須是不小於 0 的數字。' })
      }
      current.bgBetAmountMin = patch.bgBetAmountMin
    }
    if (patch.bgBetAmountMax !== undefined) {
      if (!Number.isFinite(patch.bgBetAmountMax) || patch.bgBetAmountMax < 0) {
        throw createError({ statusCode: 400, message: 'BG 單注金額上限必須是不小於 0 的數字。' })
      }
      current.bgBetAmountMax = patch.bgBetAmountMax
    }
    if (current.bgBetAmountMin > current.bgBetAmountMax) {
      throw createError({ statusCode: 400, message: 'BG 單注金額下限不可高於上限。' })
    }
    if (current.retroScoreMinPct > current.retroScoreMaxPct) {
      throw createError({ statusCode: 400, message: '經典遊戲模擬分數下限不可高於上限。' })
    }
    if (patch.activeTimeSlots !== undefined) {
      if (!Array.isArray(patch.activeTimeSlots) || patch.activeTimeSlots.some((id) => !NPC_TIME_SLOT_IDS.has(id))) {
        throw createError({ statusCode: 400, message: '時段選項不正確。' })
      }
      current.activeTimeSlots = [...new Set(patch.activeTimeSlots)]
    }
    if (patch.actionIntervalSec !== undefined) {
      if (!Number.isFinite(patch.actionIntervalSec) || patch.actionIntervalSec < 0) {
        throw createError({ statusCode: 400, message: '遊戲頻率必須是不小於 0 的數字。' })
      }
      current.actionIntervalSec = patch.actionIntervalSec
    }
    if (patch.actionJitterChancePct !== undefined) {
      if (!Number.isFinite(patch.actionJitterChancePct) || patch.actionJitterChancePct < 0 || patch.actionJitterChancePct > 100) {
        throw createError({ statusCode: 400, message: '隨機延遲機率必須是 0～100 之間的數字。' })
      }
      current.actionJitterChancePct = patch.actionJitterChancePct
    }
    if (patch.actionJitterMaxSec !== undefined) {
      if (!Number.isFinite(patch.actionJitterMaxSec) || patch.actionJitterMaxSec < 0) {
        throw createError({ statusCode: 400, message: '隨機延遲上限必須是不小於 0 的數字。' })
      }
      current.actionJitterMaxSec = patch.actionJitterMaxSec
    }
    _memberSettings.set(userId, current)
    return { ...current }
  },

  /**
   * 全域心跳掛勾（見 `HFYYManage.circle()`），節流成每 `tickIntervalSec` 秒才真的動作一次。
   * @param now 目前時間（測試時可帶假時間）
   */
  tick: (now: number = Date.now()): void => {
    if (!_enabled) return
    if (now - _lastTickAt < _schedule.tickIntervalSec * 1000) return
    _lastTickAt = now

    const nowDate = new Date(now)
    for (const userId of _npcUserIds()) {
      if (!_isWithinActiveSlots(userId, nowDate)) continue
      if (!_isActionDue(userId, now)) continue
      try {
        _actOnce(userId)
      } catch {
        // 單一 NPC 這次行動失敗（例如遊戲目前不開盤），略過即可，不影響其他 NPC
      }
      _scheduleNextAction(userId, now)
    }
  }
}

function _actOnce(userId: string): void {
  const setting = _memberSettingOf(userId)
  const totalWeight = setting.bgWeight + setting.retroWeight
  if (totalWeight <= 0) return
  const playBg = Math.random() * totalWeight < setting.bgWeight
  if (playBg) _playRandomBg(userId)
  else _playRandomRetro(userId)
}

function _playRandomRetro(userId: string): void {
  const keys = _allowedKeysOf(userId, 'retro')
  if (keys.length === 0) return
  const key = keys[Math.floor(Math.random() * keys.length)] as string
  const game = (Storage.retroGames.instances as Record<string, {
    maxReasonableScore: () => number
    actions: { record: (userId: string, input: { score: number }) => unknown }
  } | undefined>)[key]
  if (!game) return

  const setting = _memberSettingOf(userId)
  const pct = setting.retroScoreMinPct + Math.random() * (setting.retroScoreMaxPct - setting.retroScoreMinPct)
  const score = Math.floor(game.maxReasonableScore() * (pct / 100))
  game.actions.record(userId, { score })
}

function _playRandomBg(userId: string): void {
  const keys = _allowedKeysOf(userId, 'bg')
  if (keys.length === 0) return
  const key = keys[Math.floor(Math.random() * keys.length)] as string

  const setting = _memberSettingOf(userId)
  if (_spentToday(userId) >= setting.dailyMaxSpend) return

  const amount = setting.bgBetAmountMin +
    Math.floor(Math.random() * (setting.bgBetAmountMax - setting.bgBetAmountMin + 1))

  const user = Storage.get.user(userId) as { coin?: number }
  if (Number(user.coin ?? 0) < amount) {
    walletBalanceService.appendChange(userId, {
      type: 'admin-topup',
      amount: setting.topUpAmount,
      note: 'NPC 自動儲值'
    })
  }

  const payload = buildBgBetPayload(key, amount)
  if (!payload) return // 該盤口尚未支援自動下注 payload，暫時跳過

  const game = (Storage.games as Record<string, { playBets: (payload: unknown, user: unknown) => unknown } | undefined>)[key]
  if (!game) return
  game.playBets(payload, user)
  _addSpent(userId, amount)
}
