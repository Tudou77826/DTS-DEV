-- OAuth 对接：sys_user.password 允许为空（统一认证建档用户无本地密码）
ALTER TABLE sys_user
    MODIFY COLUMN password VARCHAR(255) NULL;
