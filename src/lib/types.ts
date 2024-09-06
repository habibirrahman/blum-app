export interface NetworkStatus {
  connected: boolean
  connection_type: 'wifi' | 'cellular' | 'none' | 'unknown'
}

export interface User {
  id?: number
  email?: string
  name?: string
  role?: string // enum
  status?: string // enum
  restriction_type?: string // enum
  sign_in_token?: string
  deactivated_at?: string
  center_enable_sales_pipeline?: boolean
  center_enable_appointment?: boolean
  center_enable_branch?: boolean
  can_deactivate?: boolean
  parent_form_id?: number
  user_tags?: any[]
  upcoming_todos?: any[]
  branch_accesses?: any[]
}

export interface Session {
  id?: number
  slug?: string
  name?: string
  status?: string // enum
  start_time?: string
  end_time?: string
  deleted_at?: string
  current_recording_time?: (number | string)[]
  number_of_measurements?: number
  client_id?: number
  client?: Client
  user_id?: number
  user?: User
  appointment_id?: number
  appointment?: Appointment
  comments?: Comment[]
  measurements?: Measurement[]
}

export interface Client {
  id?: number
  name?: string
  birthday?: string
  email?: string
  status?: string // enum
  gender?: string // enum
  note?: string
  admitted_at?: string
  archived_at?: string
  deleted_at?: string
  discharge_reason?: string // enum
  other_discharge_reason?: string
  last_status_updated_at?: string
  center_id?: number
  prospect_id?: number
}

export interface Appointment {
  id?: number
  date?: string
  status?: string // enum
  type?: string // enum
  start_time_string?: string
  end_time_string?: string
  cancelled_at?: string
  reschedule_reason?: string // enum
  other_cancellation_reason?: string
  cancellation_reason?: string // enum
  cancelled_by?: string
  subtract_session_credit?: boolean | null
  user_id?: number
  user?: User
  client_id?: number
  room_id?: number
  room?: Room
  supervisors?: User[]
  recurring_appointment_id?: number
  credit_transaction_id?: number
  booking_appointment_id?: number
  reschedule_requester_type?: string // enum
  reschedule_requester_id?: number
  cancellation_requester_type?: string // enum
  cancellation_requester_id?: number
}

export interface Room {
  id?: number
  name?: string
  branch_id?: number
  branch?: Branch
}

export interface Branch {
  id?: number
  name?: string
  color?: string
  background_color?: string
}

export interface Comment {
  id?: number
  body?: string
  is_edited?: boolean
  user_id?: number
  user_name?: string
  commentable_id?: number
  commentable_type?: string
  created_at: string
  updated_at: string
  created_at_string: string
  updated_at_string: string
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
  session_id?: number
  target_id?: number
  target?: Target
  comment_user_id?: number
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
  client_id?: number
  curriculum_id?: number
  curriculum_color?: string
  curriculum_name?: string
  targetable_id?: number
  targetable_type?: string
  last_phase_line?: {
    label?: string
    color?: string
    description?: string
  }
}
