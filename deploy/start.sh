#!/bin/bash
# No set -e — we handle errors explicitly to avoid silent exits

echo "============================================================"
echo "  CleanTalk — Starting All Services"
echo "============================================================"

PORT=${PORT:-3000}

# ─── 1. Initialize MySQL ────────────────────────────────────
echo "[1/4] Initializing MySQL..."

if [ ! -d "/var/lib/mysql/mysql" ]; then
    echo "  First run — initializing data directory..."
    mysqld --initialize-insecure --user=mysql --datadir=/var/lib/mysql 2>/dev/null || true
fi

# Start MySQL temporarily
mysqld --user=mysql --datadir=/var/lib/mysql --skip-networking=OFF &
MYSQL_PID=$!

# Wait for MySQL to accept connections
echo "  Waiting for MySQL..."
for i in $(seq 1 30); do
    if mysqladmin ping --silent 2>/dev/null; then
        echo "  MySQL is ready."
        break
    fi
    sleep 1
done

# Set up database and schema
echo "  Creating database..."
mysql -u root <<EOF 2>/dev/null || true
ALTER USER 'root'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
FLUSH PRIVILEGES;
EOF

# Run master schema
echo "  Applying schema..."
mysql -u root -p"${DB_PASSWORD}" "${DB_NAME}" < /app/database/MASTER_SETUP.sql 2>/dev/null || true

# Add moderation columns (idempotent)
mysql -u root -p"${DB_PASSWORD}" "${DB_NAME}" <<'MIGRATION' 2>/dev/null || true
ALTER TABLE posts ADD COLUMN moderation_status ENUM('pending','approved','warned','blocked') DEFAULT 'approved';
ALTER TABLE comments ADD COLUMN status ENUM('pending','approved','warned','blocked') DEFAULT 'approved';
CREATE TABLE IF NOT EXISTS moderation_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT, post_id INT, content TEXT,
    content_type ENUM('comment','caption','image') NOT NULL,
    prediction VARCHAR(50), confidence FLOAT, labels JSON, action_taken VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id), INDEX idx_post (post_id),
    INDEX idx_type (content_type), INDEX idx_action (action_taken)
);
CREATE TABLE IF NOT EXISTS worker_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    worker_id VARCHAR(50), job_id VARCHAR(100), comment_id INT,
    content_type VARCHAR(20) DEFAULT 'comment', status VARCHAR(20),
    processing_time_ms INT, error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reporter_id INT NOT NULL, reported_user_id INT, post_id INT, comment_id INT,
    reason ENUM('spam','harassment','hate_speech','violence','nudity','misinformation','other') NOT NULL,
    description TEXT, status ENUM('pending','reviewed','resolved','dismissed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE, push_notifications BOOLEAN DEFAULT TRUE,
    private_account BOOLEAN DEFAULT FALSE, show_activity_status BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    language VARCHAR(10) DEFAULT 'en', theme VARCHAR(10) DEFAULT 'dark',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
MIGRATION

echo "  Database ready ✓"

# Stop temporary MySQL — Supervisor will manage it
echo "  Stopping temporary MySQL..."
kill $MYSQL_PID 2>/dev/null || true
wait $MYSQL_PID 2>/dev/null || true
sleep 1
echo "  Temporary MySQL stopped ✓"

# ─── 2. Configure Nginx port ────────────────────────────────
echo "[2/4] Configuring Nginx on port ${PORT}..."
sed -i "s/listen __PORT__/listen ${PORT}/" /etc/nginx/sites-available/default

# ─── 3. Remove default nginx site conflict ───────────────────
echo "[3/4] Setting up Nginx..."
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/cleantalk

# ─── 4. Start all services via Supervisor ────────────────────
echo "[4/4] Starting all services..."
echo "  ✓ MySQL      (localhost:3306)"
echo "  ✓ Redis      (localhost:6379)"
echo "  ✓ Backend    (localhost:5000)"
echo "  ✓ AI Service (localhost:8000)"
echo "  ✓ AI Worker  (BullMQ consumer)"
echo "  ✓ Nginx      (port ${PORT})"
echo ""
echo "============================================================"
echo "  CleanTalk is running on port ${PORT}"
echo "============================================================"

exec supervisord -n -c /etc/supervisor/supervisord.conf
