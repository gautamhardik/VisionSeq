import time
from collections import defaultdict
from fastapi import Request, HTTPException, status

class TokenBucketLimiter:
    def __init__(self, rate: float, capacity: float):
        """
        rate: tokens per second
        capacity: maximum burst capacity
        """
        self.rate = rate
        self.capacity = capacity
        self.buckets = defaultdict(lambda: float(capacity))
        self.last_check = defaultdict(time.time)

    def is_allowed(self, ip: str) -> bool:
        now = time.time()
        elapsed = now - self.last_check[ip]
        self.last_check[ip] = now
        
        # Replenish tokens
        self.buckets[ip] = min(self.capacity, self.buckets[ip] + elapsed * self.rate)
        
        if self.buckets[ip] >= 1.0:
            self.buckets[ip] -= 1.0
            return True
        return False

# Allow 2 requests per second (120 per minute) with a burst capacity of 5 requests
limiter = TokenBucketLimiter(rate=2.0, capacity=5.0)

def rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later."
        )
