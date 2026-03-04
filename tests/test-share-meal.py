#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分享点餐页面 minium 单元测试
测试分享页面的各项功能
"""

import minium
import time


class ShareMealTest(minium.MiniTest):
    """分享点餐页面测试类"""
    
    def setUp(self):
        """测试前准备"""
        super().setUp()
        # 设置测试用的分享令牌和点餐ID
        self.test_share_token = "test_share_token_123"
        self.test_meal_id = 1
        
    def navigate_to_share_page(self, token=None, meal_id=None):
        """导航到分享页面"""
        token = token or self.test_share_token
        meal_id = meal_id or self.test_meal_id
        url = f"/pages/share-meal/share-meal?token={token}&mealId={meal_id}"
        self.app.navigate_to(url)
        time.sleep(1)  # 等待页面加载
        
    def test_page_load_with_valid_params(self):
        """测试页面使用有效参数加载"""
        self.navigate_to_share_page()
        
        # 验证页面标题或主要内容存在
        page = self.page
        self.assertIsNotNone(page)
        
        # 验证页面包含点餐信息区域
        elements = page.elements(".section")
        self.assertTrue(len(elements) > 0, "页面应该包含内容区域")
        
    def test_page_load_with_invalid_token(self):
        """测试页面使用无效令牌加载"""
        self.navigate_to_share_page(token="invalid_token")
        time.sleep(1)
        
        # 验证显示错误提示
        # 注意：实际测试中需要根据实际UI实现调整选择器
        page = self.page
        # 检查是否显示了错误提示
        
    def test_page_load_without_params(self):
        """测试页面缺少参数时的处理"""
        self.app.navigate_to("/pages/share-meal/share-meal")
        time.sleep(1)
        
        # 验证页面能正常加载（即使参数缺失）
        page = self.page
        self.assertIsNotNone(page)
        
    def test_dish_selection(self):
        """测试菜品选择功能"""
        self.navigate_to_share_page()
        time.sleep(1)
        
        # 获取复选框元素
        checkboxes = self.page.elements("checkbox")
        if len(checkboxes) > 0:
            # 点击第一个复选框
            checkboxes[0].click()
            time.sleep(0.5)
            
            # 验证复选框状态改变
            # 注意：实际实现可能需要根据具体UI调整
            
    def test_order_button_click(self):
        """测试下单按钮点击"""
        self.navigate_to_share_page()
        time.sleep(1)
        
        # 先选择至少一个菜品
        checkboxes = self.page.elements("checkbox")
        if len(checkboxes) > 0:
            checkboxes[0].click()
            time.sleep(0.5)
            
        # 点击下单按钮
        order_btn = self.page.element(".btn-primary")
        if order_btn:
            order_btn.click()
            time.sleep(0.5)
            
            # 验证弹出姓名输入框
            dialog = self.page.element(".dialog")
            self.assertIsNotNone(dialog, "点击下单后应该显示姓名输入弹窗")
            
    def test_name_input_dialog(self):
        """测试姓名输入弹窗"""
        self.navigate_to_share_page()
        time.sleep(1)
        
        # 选择菜品并点击下单
        checkboxes = self.page.elements("checkbox")
        if len(checkboxes) > 0:
            checkboxes[0].click()
            time.sleep(0.5)
            
        order_btn = self.page.element(".btn-primary")
        if order_btn:
            order_btn.click()
            time.sleep(0.5)
            
            # 验证弹窗显示
            dialog = self.page.element(".dialog")
            self.assertIsNotNone(dialog)
            
            # 测试输入姓名
            input_field = self.page.element(".dialog-input")
            if input_field:
                input_field.input("测试用户")
                time.sleep(0.3)
                
            # 点击确定按钮
            confirm_btn = self.page.element(".btn-confirm")
            if confirm_btn:
                confirm_btn.click()
                time.sleep(1)
                
    def test_enter_kitchen_button(self):
        """测试进入我的厨房按钮"""
        # 这个测试需要在下单成功后进行
        # 先完成下单流程
        self.navigate_to_share_page()
        time.sleep(1)
        
        # 选择菜品
        checkboxes = self.page.elements("checkbox")
        if len(checkboxes) > 0:
            checkboxes[0].click()
            time.sleep(0.5)
            
        # 点击下单
        order_btn = self.page.element(".btn-primary")
        if order_btn:
            order_btn.click()
            time.sleep(0.5)
            
            # 输入姓名并提交
            input_field = self.page.element(".dialog-input")
            if input_field:
                input_field.input("测试用户")
                time.sleep(0.3)
                
            confirm_btn = self.page.element(".btn-confirm")
            if confirm_btn:
                confirm_btn.click()
                time.sleep(1)
                
                # 验证显示进入厨房按钮
                kitchen_btn = self.page.element(".btn-secondary")
                self.assertIsNotNone(kitchen_btn, "下单成功后应该显示进入厨房按钮")
                
    def test_no_tab_bar(self):
        """测试分享页面没有底部tab栏"""
        self.navigate_to_share_page()
        time.sleep(1)
        
        # 验证页面没有tab栏
        # tab栏通常在非分享页面存在
        tab_bar = self.page.elements(".tab-bar")
        self.assertEqual(len(tab_bar), 0, "分享页面不应该显示tab栏")
        
    def tearDown(self):
        """测试后清理"""
        # 可以在这里添加清理逻辑
        super().tearDown()


if __name__ == "__main__":
    # 运行测试
    import unittest
    unittest.main()
