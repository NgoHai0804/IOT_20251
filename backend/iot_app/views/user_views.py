from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication

class UserViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()
    serializer_class = UserSerializer


class ProfileView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'status': True,
            'data': {
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone
            }
        })
