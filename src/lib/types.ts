export interface User {
  id?: number
  email?: string
  name?: string
  role?: string // not
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
  status?: string // not
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
  discharge_reason?: string // not
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

export type MeasurementType =
  | 'Measurement::Duration'
  | 'Measurement::Frequency'
  | 'Measurement::Percentage'
  | 'Measurement::Pir'
  | 'Measurement::Probing'
  | 'Measurement::Prompting'
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
  session_id?: Session['id']
  target_id?: Target['id']
  target?: Target
  comment_user_id?: User['id']
  comment_user?: Comment
}

export type TargetType =
  | 'Target::Duration'
  | 'Target::Frequency'
  | 'Target::Percentage'
  | 'Target::Pir'
  | 'Target::Prompting'
export type TargetStatus = 'pending' | 'in_progress' | 'mastered' | 'paused' | 'discontinued'
export interface Target {
  id?: number
  type?: TargetType
  status?: TargetStatus
  name?: string
  description?: string
  goal?: number
  probing_goal?: number
  number_of_trial?: number
  probing_number_of_trial?: number
  interval?: number
  duration?: number
  goal_time?: string
  success_metric?: string
  completed?: boolean
  probing_enable?: boolean
  deleted_at?: string
  date_introduce?: string
  date_mastered?: string
  client_id?: Client['id']
  curriculum_id?: Curriculum['id']
  curriculum_color?: Curriculum['color']
  curriculum_name?: Curriculum['name']
  targetable_id?: number // not
  targetable_type?: string // not
  last_phase_line?: {
    label?: string
    color?: string
    description?: string
  }
}

export interface Curriculum {
  id?: number
  color?: string
  name?: string
}
