from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.authtoken.models import Token
from iot_app.models import User

# Đăng ký
class RegisterView(APIView):
    def post(self, request):
        data = request.data
        email = data.get('email')
        password = data.get('password')
        full_name = data.get('full_name')
        phone = data.get('phone', '')

        # Kiểm tra dữ liệu đầu vào
        if not email or not password or not full_name:
            return Response({
                'status': False,
                'message': 'Thiếu thông tin cần thiết (email, password, full_name)'
            }, status=status.HTTP_400_BAD_REQUEST)


        # Kiểm tra email trùng
        if User.objects.filter(email=email).exists():
            return Response({
                'status': False,
                'message': 'Email đã được sử dụng'
            }, status=status.HTTP_400_BAD_REQUEST)


        # Tạo user mới
        user = User.objects.create(
            full_name=full_name,
            email=email,
            password_hash=make_password(password),
            phone=phone
        )

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'status': True,
            'message': 'Đăng ký thành công',
            'token': token.key,
            'data': {
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone
            }
        }, status=status.HTTP_201_CREATED)


# Đăng nhập
class LoginView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({
                'status': False,
                'message': 'Thiếu email hoặc mật khẩu'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'status': False,
                'message': 'Sai tài khoản hoặc mật khẩu'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Kiểm tra mật khẩu
        if not check_password(password, user.password_hash):
            return Response({
                'status': False,
                'message': 'Sai tài khoản hoặc mật khẩu'
            }, status=status.HTTP_400_BAD_REQUEST)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'status': True,
            'message': 'Đăng nhập thành công',
            'token': token.key,
            'data': {
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone
            }
        })


class LogoutView(APIView):
    """
    Đăng xuất người dùng -> xóa token
    """
    def post(self, request):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Token '):
            return Response({
                'status': False,
                'message': 'Thiếu hoặc sai định dạng Authorization header'
            }, status=status.HTTP_400_BAD_REQUEST)

        token_key = auth_header.replace('Token ', '').strip()

        deleted, _ = Token.objects.filter(key=token_key).delete()

        if deleted == 0:
            return Response({
                'status': False,
                'message': 'Token không hợp lệ hoặc đã hết hạn'
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'status': True,
            'message': 'Đăng xuất thành công'
        }, status=status.HTTP_200_OK)
