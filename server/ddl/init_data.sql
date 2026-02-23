-- ========================================================
-- 初始化数据脚本
-- 创建默认厨房和其他初始数据
-- ========================================================

-- 注意：此脚本需要在用户创建后执行
-- 为每个用户创建默认厨房【我的厨房】

-- 插入默认厨房的存储过程
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS `init_default_kitchen`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_user_id BIGINT;
    
    -- 游标：遍历所有没有默认厨房的用户
    DECLARE user_cursor CURSOR FOR
        SELECT u.id 
        FROM wte_users u
        LEFT JOIN wte_kitchens k ON u.id = k.user_id AND k.is_default = 1 AND k.status = 1
        WHERE k.id IS NULL;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN user_cursor;
    
    read_loop: LOOP
        FETCH user_cursor INTO v_user_id;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- 为该用户创建默认厨房
        INSERT INTO wte_kitchens (user_id, name, description, is_default, status)
        VALUES (v_user_id, '我的厨房', '默认厨房', 1, 1);
        
    END LOOP;
    
    CLOSE user_cursor;
END //

DELIMITER ;

-- 执行存储过程
CALL init_default_kitchen();

-- 删除存储过程
DROP PROCEDURE IF EXISTS init_default_kitchen;
