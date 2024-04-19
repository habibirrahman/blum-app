export interface User {
  id?: string | number,
  email?: string,
  name?: string,
  role?: string, // enum
  status?: string, // enum
  restriction_type?: string, // enum
  sign_in_token?: string,
  user_tags?: any[], // object[]
}