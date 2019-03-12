from typing import Dict, List, Optional, Sequence, Tuple, overload

from typing_extensions import Literal

from .connection import ConnectionPool

class Redis:
    connection_pool: ConnectionPool

    @classmethod
    def from_url(cls, url: str, db: int = None) -> Redis: ...

    def config_get(self, pattern: str = ...) -> Dict[str, str]: ...

    def config_set(self, name: str, value: str) -> None: ...

    def get(self, name: str) -> Optional[bytes]: ...

    def lindex(self, name: str, index: int) -> Optional[bytes]: ...

    def llen(self, name: str) -> int: ...

    def lrange(self, name: str, start: int, end: int) -> List[bytes]: ...

    def pubsub(self) -> PubSub: ...

    def register_script(self, script: str) -> Script: ...

    def zadd(self, name: str, mapping: Dict[bytes, float]) -> int: ...

    def zcard(self, name: str) -> int: ...

    @overload
    def zrange(self, name: str, start: int, end: int, *,
               withscores: Literal[False] = ...) -> List[bytes]: ...
    @overload
    def zrange(self, name: str, start: int, end: int, *,
               withscores: Literal[True]) -> List[Tuple[bytes, float]]: ...

    def zrank(self, name: str, value: bytes) -> int: ...

    def zrem(self, name: str, *values: bytes) -> int: ...

    def zscore(self, name: str, value: bytes) -> float: ...

StrictRedis = Redis

class PubSub:
    def close(self) -> None: ...

    def subscribe(self, *args: str) -> None: ...

    def get_message(self, ignore_subscribe_messages: bool = ...,
                    timeout: float = ...) -> Optional[Dict[str, object]]: ...

class Script:
    def __call__(self, keys: Sequence[str] = ...) -> object: ...
