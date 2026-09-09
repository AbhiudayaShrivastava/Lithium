"""
Lithium Autonomous Operations Platform — Embedded Kafka Event Streaming Engine (Path C)
Implements an event-driven pub/sub architecture with partitioned topics, sequential offsets,
producers, consumer groups, and stream processing.
"""

import asyncio
import time
import json
import datetime
import random
from typing import Dict, List, Any, Optional, Callable


class KafkaMessage:
    def __init__(self, topic: str, partition: int, offset: int, key: Optional[str], value: Dict[str, Any]):
        self.topic = topic
        self.partition = partition
        self.offset = offset
        self.key = key
        self.value = value
        self.timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "topic": self.topic,
            "partition": self.partition,
            "offset": self.offset,
            "key": self.key,
            "value": self.value,
            "timestamp": self.timestamp
        }


class KafkaPartition:
    def __init__(self, partition_id: int):
        self.partition_id = partition_id
        self.log: List[KafkaMessage] = []
        self.next_offset = 0

    def append(self, topic: str, key: Optional[str], value: Dict[str, Any]) -> KafkaMessage:
        msg = KafkaMessage(
            topic=topic,
            partition=self.partition_id,
            offset=self.next_offset,
            key=key,
            value=value
        )
        self.log.append(msg)
        self.next_offset += 1
        # Keep maximum 5,000 in-memory messages per partition
        if len(self.log) > 5000:
            self.log.pop(0)
        return msg


class KafkaTopic:
    def __init__(self, name: str, num_partitions: int = 3):
        self.name = name
        self.num_partitions = num_partitions
        self.partitions = [KafkaPartition(i) for i in range(num_partitions)]

    def produce(self, key: Optional[str], value: Dict[str, Any]) -> KafkaMessage:
        # Partition selection via key hashing or round-robin
        if key:
            p_id = abs(hash(key)) % self.num_partitions
        else:
            p_id = random.randint(0, self.num_partitions - 1)
        return self.partitions[p_id].append(self.name, key, value)

    def get_messages(self, partition_id: int, start_offset: int, limit: int = 50) -> List[KafkaMessage]:
        if 0 <= partition_id < self.num_partitions:
            part = self.partitions[partition_id]
            return [m for m in part.log if m.offset >= start_offset][:limit]
        return []

    def total_messages(self) -> int:
        return sum(len(p.log) for p in self.partitions)


class KafkaBroker:
    def __init__(self):
        self.topics: Dict[str, KafkaTopic] = {}
        self.metrics = {
            "total_produced": 0,
            "total_consumed": 0,
            "messages_per_sec": 0,
            "uptime_sec": 0,
            "started_at": time.time()
        }
        self._init_standard_topics()

    def _init_standard_topics(self):
        # 4 Core SRE Topics
        self.create_topic("cluster-telemetry", num_partitions=3)
        self.create_topic("chaos-events", num_partitions=2)
        self.create_topic("remediation-commands", num_partitions=2)
        self.create_topic("audit-trail", num_partitions=1)

    def create_topic(self, name: str, num_partitions: int = 3) -> KafkaTopic:
        if name not in self.topics:
            self.topics[name] = KafkaTopic(name, num_partitions)
        return self.topics[name]

    def get_topic(self, name: str) -> Optional[KafkaTopic]:
        return self.topics.get(name)

    def produce(self, topic_name: str, key: Optional[str], value: Dict[str, Any]) -> KafkaMessage:
        topic = self.get_topic(topic_name)
        if not topic:
            topic = self.create_topic(topic_name)
        msg = topic.produce(key, value)
        self.metrics["total_produced"] += 1
        return msg

    def get_status(self) -> Dict[str, Any]:
        uptime = round(time.time() - self.metrics["started_at"], 1)
        topic_summaries = {}
        for name, topic in self.topics.items():
            topic_summaries[name] = {
                "partitions": topic.num_partitions,
                "total_messages": topic.total_messages(),
                "latest_offsets": [p.next_offset for p in topic.partitions]
            }
        return {
            "broker_status": "ONLINE (Embedded Kafka Engine)",
            "uptime_seconds": uptime,
            "total_produced": self.metrics["total_produced"],
            "total_consumed": self.metrics["total_consumed"],
            "topics": topic_summaries
        }


# Singleton Broker Instance
_BROKER = KafkaBroker()


def get_kafka_broker() -> KafkaBroker:
    return _BROKER


class KafkaProducer:
    """Standard Kafka Producer client interface."""
    def __init__(self, broker: KafkaBroker = _BROKER):
        self.broker = broker

    def send(self, topic: str, value: Dict[str, Any], key: Optional[str] = None) -> KafkaMessage:
        return self.broker.produce(topic, key, value)


class KafkaConsumer:
    """Standard Kafka Consumer client interface with offset management."""
    def __init__(self, topics: List[str], group_id: str = "lithium-sre-group", broker: KafkaBroker = _BROKER):
        self.broker = broker
        self.topics = topics
        self.group_id = group_id
        # consumer offsets: (topic, partition) -> next offset to read
        self.offsets: Dict[tuple, int] = {}
        for t in topics:
            top = self.broker.get_topic(t)
            if top:
                for p in range(top.num_partitions):
                    self.offsets[(t, p)] = 0

    def poll(self, max_records: int = 10) -> List[KafkaMessage]:
        records = []
        for t in self.topics:
            top = self.broker.get_topic(t)
            if not top:
                continue
            for p in range(top.num_partitions):
                current_off = self.offsets.get((t, p), 0)
                msgs = top.get_messages(p, current_off, limit=max_records - len(records))
                for m in msgs:
                    records.append(m)
                    self.offsets[(t, p)] = m.offset + 1
                    self.broker.metrics["total_consumed"] += 1
                if len(records) >= max_records:
                    break
            if len(records) >= max_records:
                break
        return records
