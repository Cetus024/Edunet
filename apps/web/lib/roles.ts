export type EduNetsRole = 'student' | 'teacher' | 'tutor' | 'parent';

export function isTeachingRole(
  role: EduNetsRole | null | undefined,
): role is 'teacher' | 'tutor' {
  return role === 'teacher' || role === 'tutor';
}

export function getRoleLabel(role: EduNetsRole | null | undefined): string {
  switch (role) {
    case 'teacher':
      return 'Teacher';
    case 'tutor':
      return 'Tutor';
    case 'parent':
      return 'Parent';
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
