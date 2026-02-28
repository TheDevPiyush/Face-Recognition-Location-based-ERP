from rest_framework.response import Response
from rest_framework import status


def check_allow_roles(user, allowed_roles: list):
    """
    Checks if the user role is in the allowed list.
    Returns None if allowed,
    or a Response object if not allowed.
    """
    if user.is_deleted or not user.is_active:
        return Response(
            {"message": "User is either deleted or inactive."},
            status=status.HTTP_403_FORBIDDEN,
        )
    elif user.role not in allowed_roles:
        return Response(
            {"message": "You are not authorized to perform this action."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None
#