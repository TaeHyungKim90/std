"""
관리자 → 개별 직원 메시지 발송, 수신함 조회, 읽음 처리 통합.
"""
from fastapi import status


def test_individual_message_inbox_and_mark_read(
	integration_admin_client,
	integration_employee_client,
):
	r_me = integration_employee_client.get("/api/auth/me")
	assert r_me.status_code == status.HTTP_200_OK, r_me.text
	receiver_pk = r_me.json()["id"]

	r_send = integration_admin_client.post(
		"/api/messages/",
		json={
			"title": "pytest 통합 메시지",
			"content": "본문",
			"message_type": "individual",
			"is_global": False,
			"receiver_id": receiver_pk,
			"file_ids": [],
		},
	)
	assert r_send.status_code == status.HTTP_200_OK, r_send.text
	msg_id = r_send.json()["id"]

	r_inbox = integration_employee_client.get("/api/messages/inbox", params={"limit": 50})
	assert r_inbox.status_code == status.HTTP_200_OK, r_inbox.text
	items = r_inbox.json().get("items", [])
	assert any(m.get("id") == msg_id for m in items)

	r_read = integration_employee_client.put(f"/api/messages/{msg_id}/read")
	assert r_read.status_code == status.HTTP_200_OK, r_read.text
	assert r_read.json().get("is_read") is True

	r_out = integration_admin_client.get("/api/messages/outbox", params={"limit": 50})
	assert r_out.status_code == status.HTTP_200_OK, r_out.text
	out_items = r_out.json().get("items", [])
	assert any(m.get("id") == msg_id for m in out_items)
