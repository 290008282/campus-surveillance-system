import { Form, Input, Button, message } from 'antd';
import { observer } from 'mobx-react';
import { type FC, useEffect, useState } from 'react';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import crypto from 'crypto-js';
import Style from './index.module.less';
import { history } from 'umi';
import mobxStore from '@/mobxStore';
import services from '@/services';
import brandIcon from '@/assets/icon.png';
import constants from '@/constants';

interface IFormData {
  username: string;
  password: string;
}

const Login: FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [loginForm] = Form.useForm<IFormData>();

  document.title = '智慧园区 · 监控管理系统';

  useEffect(() => {
    if (mobxStore.user.token.length > 0) {
      history.push('/campusState');
    }
  }, [mobxStore.user.token]);

  const handleLogin = async (formData: IFormData) => {
    setLoading(true);
    try {
      const res = await services['POST /api/user/login']({
        username: formData.username,
        password: crypto
          .HmacSHA256(formData.password, constants.SHA256KEY)
          .toString(crypto.enc.Base64),
      });
      const { token, userInfo } = res.data;
      mobxStore.user.setToken(token);
      mobxStore.user.setUserInfo(userInfo);
    } catch (error) {
      console.error(error);
      message.error(String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={Style.body}>
      {/* Animated grid background */}
      <div className={Style.gridBg} />

      <div className={Style.card}>
        <div className={Style.glowLine} />

        <div className={Style.formPanel}>
          <div className={Style.brandArea}>
            <img className={Style.brandIcon} src={brandIcon} alt="" />
            <div className={Style.brandName}>CAMPUS GUARD</div>
            <div className={Style.brandSub}>智慧园区 · 监控管理系统</div>
          </div>

          <Form
            className={Style.loginForm}
            onFinish={handleLogin}
            form={loginForm}
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="账号"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                style={{ width: '100%' }}
                type="primary"
                htmlType="submit"
                className={Style.loginBtn}
                loading={loading}
              >
                登 录
              </Button>
            </Form.Item>
          </Form>

          <div className={Style.footer}>
            <span className={Style.version}>v0.1.2</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default observer(Login);
