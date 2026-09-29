export type ProjectStatus = 'live' | 'building' | 'archived'

/** 列表頁卡片用——刻意不含 Know-how／Architecture 欄位 */
export type ProjectSummary = {
  slug: string
  no: string
  name: string
  tagline: string
  year: string
  status: ProjectStatus
  techStack: string[]
}

export type FeatureCard = {
  title: string
  description: string
}

export type ArchitectureNode = {
  id: string
  label: string
  detail?: string
}

/** 一層架構（由上而下堆疊），同一層內的 nodes 是平行關係（例如四個 domain services） */
export type ArchitectureLayer = {
  label: string
  nodes: ArchitectureNode[]
}

export type ArchitectureContent = {
  layers: ArchitectureLayer[]
  notes: string[]
}

export type EvidenceCard = {
  title: string
  description: string
  refLabel?: string
  refHref?: string
}

export type KnowHowItem = {
  title: string
  synopsis?: string
}

export type KnowHowGroupKey = 'research' | 'architecture' | 'decision-log'

export type KnowHowGroup = {
  key: KnowHowGroupKey
  title: string
  /** 詳細頁只渲染這個（4~8 項精選） */
  highlights: KnowHowItem[]
  /** 附頁渲染完整版 */
  full: KnowHowItem[]
}

export type MetricCard = {
  label: string
  value: string
  caption: string
}

export type DetailContent = {
  slug: string
  overview: string
  problem: string
  solution: string[]
  keyFeatures: FeatureCard[]
  architecture: ArchitectureContent
  engineeringEvidence: EvidenceCard[]
  /** 固定 3 組：research / architecture / decision-log */
  knowHow: KnowHowGroup[]
  techStack: string[]
  result: {
    metrics: MetricCard[]
    summary: string
  }
  knowHowOverflowPath?: string
}
