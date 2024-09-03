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
  comments?: any[]
  measurements?: any[]
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