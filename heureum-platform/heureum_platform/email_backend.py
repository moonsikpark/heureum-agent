# Copyright (c) 2026 Heureum AI. All rights reserved.

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

from azure.communication.email import EmailClient


class AzureCommunicationEmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.connection_string = settings.AZURE_COMMUNICATION_CONNECTION_STRING

    def send_messages(self, email_messages):
        if not self.connection_string:
            return 0

        client = EmailClient.from_connection_string(self.connection_string)
        sent_count = 0

        for message in email_messages:
            try:
                content = {"subject": message.subject, "plainText": message.body}

                # Check for HTML alternative (EmailMultiAlternatives)
                if hasattr(message, "alternatives"):
                    for alt_content, mimetype in message.alternatives:
                        if mimetype == "text/html":
                            content["html"] = alt_content
                            break
                elif message.content_subtype == "html":
                    content = {"subject": message.subject, "html": message.body}

                recipients = {"to": [{"address": addr} for addr in message.to]}

                email_message = {
                    "senderAddress": message.from_email or settings.DEFAULT_FROM_EMAIL,
                    "content": content,
                    "recipients": recipients,
                }

                poller = client.begin_send(email_message)
                poller.result()
                sent_count += 1
            except Exception:
                if not self.fail_silently:
                    raise

        return sent_count
