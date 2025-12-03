export interface User {
  id?: number
  email?: string
  name?: string
  role?: 'admin' | 'staff'
  status?: string // not
  restriction_type?: string // not
  sign_in_token?: string
  deactivated_at?: string
  center_enable_sales_pipeline?: boolean
  center_enable_appointment?: boolean
  center_enable_branch?: boolean
  can_deactivate?: boolean
  parent_form_id?: number // not
  user_tags?: any[] // not
  upcoming_todos?: any[] // not
  branch_accesses?: any[] // not
}

export interface Session {
  id?: number
  slug?: string
  name?: string
  status?: 'draft' | 'ongoing' | 'completed' | 'cancelled'
  start_time?: string
  end_time?: string
  deleted_at?: string
  current_recording_time?: (number | string)[]
  number_of_measurements?: number
  client_id?: Client['id']
  client?: Client
  user_id?: User['id']
  user?: User
  appointment_id?: Appointment['id']
  appointment?: Appointment
  comments?: Comment[]
  measurements?: Measurement[]
}

export type ClientStatus = 'active' | 'archived' | 'at_risk_of_discharge'
export type ClientDischargeReason =
  | 'graduated'
  | 'family_or_personal_issues'
  | 'expectations_did_not_match'
  | 'schedule_conflict'
  | 'moving'
  | 'other'
export interface Client {
  id?: number
  name?: string
  birthday?: string
  email?: string
  status?: ClientStatus
  gender?: string // not
  note?: string
  admitted_at?: string
  archived_at?: string
  deleted_at?: string
  discharge_reason?: ClientDischargeReason
  other_discharge_reason?: string
  last_status_updated_at?: string
  total_recommendation?: number
  tags?: { id?: number; label_id?: number; name?: string }[]
  pre_session_assessments?: Assessment[]
  accesses?: { id?: number; client_id?: Client['id']; user_id?: User['id']; user?: User }[]
  branches?: Branch[]
  running_create_target_job?: any // not
  documents?: any[] // not
  center_id?: number // not
  prospect_id?: number // not

  // for storage
  upcoming_sessions?: Session[]
  draft_sessions?: Session[]
  past_sessions?: Session[]
}

export interface Assessment {
  id?: number
  date?: string
  observer?: User['name']
  start_time?: string
  end_time?: string
  antecedent?: string
  behavior?: string
  consequence?: string
  escape_or_avoidance?: boolean
  gaining_attention?: boolean
  expression_of_anger?: boolean
  frustation?: boolean
  obtain_tangible_item?: boolean
  sensory_stimulation?: boolean
  fear_or_anxiety?: boolean
  other?: boolean
  deleted_at?: string
  client_id?: Client['id']
  user_id?: User['id']
  session_id?: Session['id']
}

export interface Appointment {
  id?: number
  date?: string
  status?: string // not
  type?: string // not
  start_time_string?: string
  end_time_string?: string
  cancelled_at?: string
  reschedule_reason?: string // not
  other_cancellation_reason?: string
  cancellation_reason?: string // not
  cancelled_by?: string
  subtract_session_credit?: boolean | null
  user_id?: User['id']
  user?: User
  client_id?: Client['id']
  room_id?: Room['id']
  room?: Room
  supervisors?: User[]
  recurring_appointment_id?: number // not
  credit_transaction_id?: number // not
  booking_appointment_id?: number // not
  reschedule_requester_type?: 'User' | 'Client'
  reschedule_requester_id?: User['id'] | Client['id']
  cancellation_requester_type?: 'User' | 'Client'
  cancellation_requester_id?: User['id'] | Client['id']
}

export interface Room {
  id?: number
  name?: string
  branch_id?: Branch['id']
  branch?: Branch
}

export interface Branch {
  id?: number
  name?: string
  color?: string
  background_color?: string
}

export interface Comment {
  id?: number | string
  body?: string
  is_edited?: boolean
  user_id?: number
  user_name?: User['name']
  target_name?: Target['name']
  color?: Curriculum['color']
  antecedent?: string
  behavior?: string
  consequence?: string
  images?: ImageData[]
  type?: 'Assessment::InSession' // not
  client_id?: Client['id']
  session_id?: Session['id']
  measurement_id?: Measurement['id']
  commentable_id?: number
  commentable_type?: string
  created_at?: string
  updated_at?: string
  created_at_string?: string
  updated_at_string?: string
}
interface ImageData {
  id?: number
  base64: string
  file_name: string
  created_at?: string
  file_url?: string
  size: number
  width: number
  height: number
}
export type MeasurementType =
  | 'Measurement::ColdProbe'
  | 'Measurement::Duration'
  | 'Measurement::Frequency'
  | 'Measurement::Latency'
  | 'Measurement::Percentage'
  | 'Measurement::Pir'
  | 'Measurement::Probing'
  | 'Measurement::Prompting'
  | 'Measurement::Sbt'
  | 'Measurement::TrialByTrial'
export interface Measurement {
  id?: number
  type?: MeasurementType
  marked_as?: TargetStatus
  position?: number
  results?: any
  comment?: string
  is_fixed?: boolean
  is_dropped?: boolean
  visible?: boolean
  deleted_at?: string
  submitted_at?: string
  created_at?: string
  updated_at?: string
  session_id?: Session['id']
  target_id?: Target['id']
  target?: Target
  comment_user_id?: User['id']
  comment_user?: Comment
  used_targets?: UsedTargetMeasurement[]
}
export interface UsedTargetMeasurement {
  target_id?: Target['id']
  description: Target['description']
  target_code: Target['code_definition']
  target_name: Target['name']
}

export type TargetType =
  | 'Target::ColdProbe'
  | 'Target::Duration'
  | 'Target::Frequency'
  | 'Target::Latency'
  | 'Target::Percentage'
  | 'Target::Pir'
  | 'Target::Prompting'
  | 'Target::Sbt'
  | 'Target::TrialByTrial'
export type TargetStatus = 'pending' | 'in_progress' | 'mastered' | 'paused' | 'discontinued'
export type TargetPromptingFormat = 'classic' | 'custom'
export type TargetColdProbeFormat = 'classic' | 'custom'
export interface Target {
  id?: number
  action_recommendations?: ActionRecommendation[]
  type?: TargetType
  status?: TargetStatus
  prompting_format?: TargetPromptingFormat
  cold_probe_format?: TargetColdProbeFormat

  name?: string
  description?: string
  goal_time?: string
  success_metric?: string
  type_name?: string
  code_definition?: string
  graph_color?: string

  goal?: number
  probing_goal?: number
  number_of_trial?: number
  probing_number_of_trial?: number
  interval?: number
  duration?: number
  total_success?: number
  consecutive_success?: number

  completed?: boolean
  probing_enable?: boolean
  is_group?: boolean
  enable_problem_behavior?: boolean

  date_introduce?: string
  date_mastered?: string
  created_at?: string
  updated_at?: string
  deleted_at?: string

  client_id?: Client['id']
  curriculum_id?: Curriculum['id']
  curriculum_color?: Curriculum['color']
  curriculum_name?: Curriculum['name']
  targetable_id?: number
  targetable_type?: 'Client' | 'Center'
  last_phase_line?: {
    label?: string
    color?: string
    description?: string
  }
  prompts?: Prompt[]
  target_tasks?: TargetTask[]
  members?: Target[]
  target_problem_behaviors?: TargetProblemBehavior[]
  target_variables?: TargetVariable[]

  group_id?: GroupTarget['id']
  group?: GroupTarget
}

export interface Prompt {
  id?: number
  prompt_parent_id?: number
  name?: string
  abbreviation?: string
  position?: number
  color?: string
  shape?: string
  score?: number
  is_used?: boolean
  is_default?: boolean
  prompting_format?: TargetPromptingFormat
  promptable_id?: number
  promptable_type?: 'Target' | 'Center'
  target_id?: Target['id'] // will be removed
  center_id?: number // will be removed
  created_at?: string
  updated_at?: string
  deleted_at?: string
}

export interface TargetTask {
  id?: number
  code?: string
  code_definition?: string
  color?: string
  date_introduce?: string
  date_mastered?: string
  description?: string
  position?: number
  status?: TargetStatus
  target_id?: Target['id']
  task_code_id?: number
  title?: string
}

export interface TargetProblemBehavior {
  id?: number
  description?: string
  code?: string
  code_definition?: string
  color?: string
  position?: number
  problem_behavior_id?: number
  target_id?: Target['id']
}

export interface TargetVariable {
  id?: number
  code?: string
  title?: string
}

export interface Curriculum {
  id?: number
  color?: string
  name?: string
}

export interface ActionRecommendation {
  id?: number
  total_success?: number
  consecutive_success?: number
  recommended_action?: string
  visible?: boolean
  passed?: boolean
  latest_session_by?: User
  target_id?: Target['id']
  target?: Target
}

export interface GroupTarget {
  id?: number
  name?: string
}
