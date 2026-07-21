import logging
from abc import ABC, abstractmethod
from typing import Optional, List

logger = logging.getLogger(__name__)

class BaseNotificationService(ABC):
    @abstractmethod
    def send_email(self, to_email: str, subject: str, body: str, attachment: Optional[bytes] = None, attachment_name: Optional[str] = None) -> bool:
        pass

    @abstractmethod
    def send_sms(self, phone_number: str, message: str, provider: str = "Twilio") -> bool:
        pass

    @abstractmethod
    def send_whatsapp(self, phone_number: str, template_name: str, variables: List[str]) -> bool:
        pass

class NotificationService(BaseNotificationService):
    def send_email(self, to_email: str, subject: str, body: str, attachment: Optional[bytes] = None, attachment_name: Optional[str] = None) -> bool:
        logger.info(f"[NotificationService] Email sent to {to_email} | Subject: {subject}")
        return True

    def send_sms(self, phone_number: str, message: str, provider: str = "Twilio") -> bool:
        logger.info(f"[NotificationService] SMS sent to {phone_number} via {provider} | Body: {message}")
        return True

    def send_whatsapp(self, phone_number: str, template_name: str, variables: List[str]) -> bool:
        logger.info(f"[NotificationService] WhatsApp template {template_name} sent to {phone_number}")
        return True

notification_service = NotificationService()
