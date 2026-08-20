from config.celery import app


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_verification_code(self, email: str, context: dict):
    """Deliver a tracking code.

    The code arrives already generated: it was written to the database by the
    request that issued it, so a retry here re-sends that same code rather than
    minting a second one and invalidating the first out from under the person
    reading their inbox.
    """
    from .emails import send_verification_code

    try:
        send_verification_code(email, context)
    except Exception as exc:
        raise self.retry(exc=exc)
