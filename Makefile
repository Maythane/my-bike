build:
	cd frontend && npm run build
	rm -rf backend/static/*
	cp -r frontend/dist/* backend/static/

dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8764 --reload

.PHONY: build dev-backend
