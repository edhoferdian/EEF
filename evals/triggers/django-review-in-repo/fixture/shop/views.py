from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Order
from .serializers import OrderSerializer


@api_view(['GET'])
def recent_orders(request):
    orders = Order.objects.all().order_by('-created_at')
    data = []
    for order in orders:
        data.append(OrderSerializer(order).data)
    return Response(data)
