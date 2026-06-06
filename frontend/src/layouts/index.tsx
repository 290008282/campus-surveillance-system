import { type FC, useEffect, useMemo, useState } from 'react';
import { Layout as AntdLayout, Menu, Dropdown, Avatar, type MenuProps } from 'antd';
import {
  DashboardOutlined,
  DesktopOutlined,
  AlertOutlined,
  UserOutlined,
  SettingOutlined,
  EnvironmentOutlined,
  CameraOutlined,
  BellOutlined,
  TeamOutlined,
  LogoutOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { observer } from 'mobx-react';
import Style from './index.module.less';
import { history, Outlet, useLocation } from 'umi';
import brandIcon from '@/assets/icon.png';
import mobxStore from '@/mobxStore';
import constants from '@/constants';
import { useFmtMsg } from '@/hooks/useFmtMsg';
import AccessAuth from '@/components/accessAuth';

const Layout: FC = () => {
  const f = useFmtMsg();
  const { pathname } = useLocation();

  const siderMenuItems = useMemo(() => {
    const items: MenuProps['items'] = [
      { label: '园区态势', key: '/campusState', icon: <DashboardOutlined /> },
      { label: '监控大屏', key: '/monitScreen', icon: <DesktopOutlined /> },
      { label: '异常报警', key: '/alarms', icon: <AlertOutlined /> },
      { label: '个人信息', key: '/userInfo', icon: <UserOutlined /> },
      mobxStore.user.role === constants.userRole.ADMIN
        ? {
            label: '系统管理',
            key: '/admin',
            icon: <SettingOutlined />,
            children: [
              { label: '园区地图', key: '/admin/mapManage', icon: <EnvironmentOutlined /> },
              { label: '摄像头管理', key: '/admin/camerasManage', icon: <CameraOutlined /> },
              { label: '报警规则', key: '/admin/alarmRulesManage', icon: <BellOutlined /> },
              { label: '用户管理', key: '/admin/usersManage', icon: <TeamOutlined /> },
            ],
          }
        : null,
    ];
    return items;
  }, [mobxStore.user.role]);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([pathname]);
  const handleSelect: MenuProps['onSelect'] = (info) => {
    const { key } = info;
    setSelectedKeys([key]);
    history.push(key);
  };

  useEffect(() => {
    document.title = `${f(pathname as any)} - ${f('title')}`;
  }, [pathname]);

  const handleLogoff = () => {
    mobxStore.user.logoff();
    history.replace('/login');
  };

  return (
    <AccessAuth>
      <AntdLayout style={{ position: 'fixed', height: '100%', width: '100%' }}>
        <AntdLayout.Header className={Style.header}>
          <div className={Style.title}>
            <img src={brandIcon} alt="LOGO" />
            <h1>{f('title')}</h1>
          </div>

          <div className={Style.headerRight}>
            <div className={Style.statusDot} />
            <span className={Style.statusText}>SYSTEM ONLINE</span>
            <Dropdown
              menu={{
                items: [
                  {
                    label: (
                      <span style={{ color: '#ef4444' }}>
                        <LogoutOutlined style={{ marginRight: 6 }} />
                        注销登录
                      </span>
                    ),
                    key: 1,
                    onClick: handleLogoff,
                  },
                ],
              }}
              placement="bottomRight"
            >
              <div className={Style.userBtn}>
                <Avatar
                  src={mobxStore.user.avatarURL}
                  size={28}
                  style={{ flexShrink: 0, border: '1px solid #1e2d42' }}
                />
                <span className={Style.username}>
                  {mobxStore.user.nickname}
                </span>
                <RightOutlined className={Style.caret} />
              </div>
            </Dropdown>
          </div>
        </AntdLayout.Header>

        <AntdLayout>
          <AntdLayout.Sider
            theme="dark"
            width={208}
            breakpoint="lg"
            collapsedWidth="56"
            className={Style.sider}
          >
            <Menu
              theme="dark"
              mode="inline"
              items={siderMenuItems}
              onSelect={handleSelect}
              selectedKeys={selectedKeys}
              defaultOpenKeys={['/admin']}
              style={{ borderRight: 'none', padding: '6px 0' }}
            />
          </AntdLayout.Sider>

          <AntdLayout.Content className={Style.content}>
            <Outlet />
          </AntdLayout.Content>
        </AntdLayout>
      </AntdLayout>
    </AccessAuth>
  );
};
export default observer(Layout);
