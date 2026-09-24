export type EduNetsRole = 'student' | 'teacher';

export function isTeachingRole(
  role: EduNetsRole | null | undefined,
): role is 'teacher' {
  return role === 'teacher';
}

export function getRoleLabel(role: EduNetsRole | null | undefined): string {
  switch (role) {
    case 'teacher':
      return 'Teacher';
    case 'student':
      return 'Student';
    default:
      return 'EduNets member';
  }
}

export function getAuthenticatedHome(
  role: EduNetsRole | null | undefined,
): '/ask-teacher' | '/dashboard' {
  return isTeachingRole(role) ? '/ask-teacher' : '/dashboard';
}
