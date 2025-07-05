-- Family Chores Database Schema
-- Initialize database with tables and admin user

USE family_chores;

-- Admin users table
CREATE TABLE admin_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- Families table
CREATE TABLE families (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    family_code VARCHAR(20) UNIQUE NOT NULL,
    admin_email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    last_assigned_child_index INT DEFAULT -1
);

-- Users table (family members)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    family_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    role ENUM('parent', 'child') NOT NULL,
    email VARCHAR(100),
    earnings DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    INDEX idx_family_role (family_id, role)
);

-- Chores table
CREATE TABLE chores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    family_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    reward_type ENUM('money', 'screen_time') NOT NULL,
    reward_amount DECIMAL(10,2) NOT NULL,
    original_reward DECIMAL(10,2) NOT NULL,
    current_reward DECIMAL(10,2) NOT NULL,
    requires_photo BOOLEAN DEFAULT FALSE,
    created_by INT NOT NULL,
    status ENUM('available', 'pending_acceptance', 'assigned', 'auto_accepted', 'pending_approval', 'completed') DEFAULT 'available',
    current_assignee INT NULL,
    first_assignee_id INT NULL,
    assignment_start_time BIGINT NULL,
    completion_start_time BIGINT NULL,
    acceptance_timer INT DEFAULT 5,
    completion_timer_enabled BOOLEAN DEFAULT FALSE,
    completion_timer_duration INT DEFAULT 0,
    completion_timer_penalty DECIMAL(10,2) DEFAULT 0,
    reduction_enabled BOOLEAN DEFAULT FALSE,
    reduction_amount DECIMAL(10,2) DEFAULT 0,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_type ENUM('daily', 'weekly') DEFAULT 'daily',
    recurring_days JSON NULL,
    last_recurred_date DATE NULL,
    scheduled_for DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (current_assignee) REFERENCES users(id),
    FOREIGN KEY (first_assignee_id) REFERENCES users(id),
    INDEX idx_family_status (family_id, status),
    INDEX idx_assignee (current_assignee),
    INDEX idx_scheduled (scheduled_for)
);

-- Chore assignments history
CREATE TABLE chore_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chore_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'declined', 'completed', 'expired') NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    reward_earned DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_chore_user (chore_id, user_id),
    INDEX idx_status (status)
);

-- Chore submissions (for approval)
CREATE TABLE chore_submissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chore_id INT NOT NULL,
    user_id INT NOT NULL,
    assignment_id INT NOT NULL,
    photo_url VARCHAR(255) NULL,
    notes TEXT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    reviewed_by INT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    rejection_reason TEXT NULL,
    FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assignment_id) REFERENCES chore_assignments(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_user (user_id)
);

-- Completed tasks tracking
CREATE TABLE completed_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chore_id INT NOT NULL,
    user_id INT NOT NULL,
    assignment_id INT NOT NULL,
    submission_id INT NULL,
    reward_earned DECIMAL(10,2) NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INT NULL,
    FOREIGN KEY (chore_id) REFERENCES chores(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assignment_id) REFERENCES chore_assignments(id),
    FOREIGN KEY (submission_id) REFERENCES chore_submissions(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_user_date (user_id, completed_at),
    INDEX idx_chore_date (chore_id, completed_at)
);

-- Family settings
CREATE TABLE family_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    family_id INT NOT NULL,
    setting_key VARCHAR(50) NOT NULL,
    setting_value JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    UNIQUE KEY unique_family_setting (family_id, setting_key)
);

-- Insert default admin user (password: AdminPass123!)
-- Password hash for 'AdminPass123!' using bcrypt
INSERT INTO admin_users (username, password_hash, email) VALUES 
('admin', '$2b$10$rQJ8YnWkYQY5qF5qF5qF5uF5qF5qF5qF5qF5qF5qF5qF5qF5qF5qF5q', 'admin@familychores.local');

-- Create sample family for testing
INSERT INTO families (name, family_code, admin_email) VALUES 
('Sample Family', 'SAMPLE123', 'sample@family.com');

-- Create sample users for the test family
INSERT INTO users (family_id, name, role, email) VALUES 
(1, 'Mom', 'parent', 'mom@family.com'),
(1, 'Dad', 'parent', 'dad@family.com'),
(1, 'Emma', 'child', 'emma@family.com'),
(1, 'Jake', 'child', 'jake@family.com'),
(1, 'Lily', 'child', 'lily@family.com');

-- Create sample chores
INSERT INTO chores (family_id, title, description, reward_type, reward_amount, original_reward, current_reward, requires_photo, created_by) VALUES 
(1, 'Clean Kitchen', 'Wipe counters, load dishwasher, sweep floor', 'money', 10.00, 10.00, 10.00, TRUE, 1),
(1, 'Take Out Trash', 'Empty all trash cans and take bins to curb', 'screen_time', 30.00, 30.00, 30.00, FALSE, 2),
(1, 'Vacuum Living Room', 'Vacuum the entire living room and under furniture', 'money', 8.00, 8.00, 8.00, TRUE, 1),
(1, 'Feed Pets', 'Feed dogs and cats, refill water bowls', 'screen_time', 15.00, 15.00, 15.00, FALSE, 2);

-- Create indexes for better performance
CREATE INDEX idx_families_code ON families(family_code);
CREATE INDEX idx_users_family_active ON users(family_id, is_active);
CREATE INDEX idx_chores_family_active ON chores(family_id, status);
CREATE INDEX idx_assignments_user_status ON chore_assignments(user_id, status);
CREATE INDEX idx_submissions_status_date ON chore_submissions(status, submitted_at);
CREATE INDEX idx_completed_user_earnings ON completed_tasks(user_id, reward_earned);

-- Create views for common queries
CREATE VIEW active_chores AS
SELECT 
    c.*,
    f.name as family_name,
    u1.name as created_by_name,
    u2.name as assignee_name
FROM chores c
JOIN families f ON c.family_id = f.id
JOIN users u1 ON c.created_by = u1.id
LEFT JOIN users u2 ON c.current_assignee = u2.id
WHERE c.status IN ('available', 'pending_acceptance', 'assigned', 'auto_accepted', 'pending_approval')
AND f.is_active = TRUE;

CREATE VIEW user_earnings AS
SELECT 
    u.id,
    u.name,
    u.family_id,
    f.name as family_name,
    COALESCE(SUM(ct.reward_earned), 0) as total_earnings,
    COUNT(ct.id) as completed_chores
FROM users u
JOIN families f ON u.family_id = f.id
LEFT JOIN completed_tasks ct ON u.id = ct.user_id
WHERE u.is_active = TRUE AND f.is_active = TRUE
GROUP BY u.id, u.name, u.family_id, f.name;

-- Trigger to update user earnings when task is completed
DELIMITER //
CREATE TRIGGER update_user_earnings 
AFTER INSERT ON completed_tasks
FOR EACH ROW
BEGIN
    UPDATE users 
    SET earnings = earnings + NEW.reward_earned 
    WHERE id = NEW.user_id;
END//
DELIMITER ;

-- Trigger to update chore status and timestamps
DELIMITER //
CREATE TRIGGER update_chore_timestamps 
BEFORE UPDATE ON chores
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

COMMIT;
