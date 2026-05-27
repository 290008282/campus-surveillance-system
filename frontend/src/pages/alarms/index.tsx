import services from '@/services';
import type ServiceTypes from '@/services/serviceTypes';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Popconfirm,
} from 'antd';
import { type ColumnType } from 'antd/es/table';
import { observer } from 'mobx-react';
import { type FC, useState } from 'react';
import Styles from './index.module.less';
import { useAntdTable } from 'ahooks';
import { useForm } from 'antd/es/form/Form';

type TableData =
  ServiceTypes['GET /api/user/getAlarmEvents']['res']['data']['list'][number];

interface FormData {
  alarmType?: string;
  cameraName?: string;
  alarmStatus?: string;
}

const Alarms: FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const columns: Array<ColumnType<TableData>> = [
    {
      title: '记录ID',
      dataIndex: 'eventID',
    },
    {
      title: '报警类型',
      dataIndex: ['alarmType'],
      render: (_v, record) => record.alarmRule.alarmRuleName,
    },

    { title: '报警源摄像头名称', dataIndex: 'cameraName' },

    {
      title: '摄像头型号',
      dataIndex: 'cameraModel',
    },
    { title: '摄像头ID', dataIndex: 'cameraID' },
    {
      title: '状态',
      dataIndex: 'alarmStatus',
      render: (_v, record) =>
        record.resolved ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已处理
          </Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">
            未处理
          </Tag>
        ),
    },
    { title: '报警时间', dataIndex: 'alarmTime' },
    {
      title: '操作',
      render: (_v, record) => (
        <Button
          type="link"
          onClick={() => {
            setModalContext(record);
            setModalVisible(true);
          }}
        >
          {record.resolved ? '查看' : '查看/处理'}
        </Button>
      ),
    },
  ];

  const [form] = useForm<FormData>();
  const { tableProps, refreshAsync, search, loading } = useAntdTable(
    async (params, formData: FormData) => {
      try {
        const res = await services['GET /api/user/getAlarmEvents']({
          current: params.current,
          pageSize: params.pageSize,
          ...formData,
        });
        return {
          total: res.data.total,
          list: res.data.list,
        };
      } catch (error) {
        message.error(String(error));
        console.error(error);
        return {
          total: 0,
          list: [],
        };
      }
    },
    { form },
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [modalContext, setModalContext] = useState<TableData | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const handleCheck = async (eventID: number) => {
    try {
      setCheckLoading(true);
      await services['POST /api/user/resolveAlarm']({ eventID });
      message.success('处理成功');
      setModalVisible(false);
      refreshAsync();
    } catch (error) {
      message.error(String(error));
      console.error(error);
    } finally {
      setCheckLoading(false);
    }
  };

  const handleBatchResolve = async () => {
    try {
      setBatchLoading(true);
      await (services as any)['POST /api/user/resolveAllAlarms']({
        eventIDs: selectedRowKeys.length > 0 ? selectedRowKeys : undefined,
      });
      message.success(
        selectedRowKeys.length > 0
          ? `已处理 ${selectedRowKeys.length} 条报警`
          : '已处理所有未处理报警',
      );
      setSelectedRowKeys([]);
      refreshAsync();
    } catch (error) {
      message.error(String(error));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    try {
      setBatchLoading(true);
      await (services as any)['POST /api/user/deleteAlarms']({
        eventIDs: selectedRowKeys,
      });
      message.success(`已删除 ${selectedRowKeys.length} 条报警`);
      setSelectedRowKeys([]);
      refreshAsync();
    } catch (error) {
      message.error(String(error));
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div className={Styles.content}>
        <Card title="异常报警记录查询">
          <Form form={form} layout="inline">
            <Form.Item name="alarmType" label="报警类型">
              <Input />
            </Form.Item>
            <Form.Item name="cameraName" label="报警源摄像头名称">
              <Input />
            </Form.Item>
            <Form.Item name="resolved" label="状态">
              <Select
                placeholder="请选择"
                options={[
                  { label: '已处理', value: true },
                  { label: '未处理', value: false },
                ]}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" onClick={search.submit}>
                查询
              </Button>
              <Button type="link" onClick={search.reset}>
                重置
              </Button>
            </Form.Item>
          </Form>

          <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button
                icon={<CheckOutlined />}
                onClick={handleBatchResolve}
                loading={batchLoading}
                disabled={selectedRowKeys.length === 0}
              >
                {selectedRowKeys.length > 0
                  ? `处理选中 (${selectedRowKeys.length})`
                  : '全部处理'}
              </Button>
              <Popconfirm
                title={`确定删除选中的 ${selectedRowKeys.length} 条报警？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  loading={batchLoading}
                  disabled={selectedRowKeys.length === 0}
                >
                  删除选中 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            </Space>
            {selectedRowKeys.length > 0 && (
              <span style={{ color: '#999' }}>
                已选择 {selectedRowKeys.length} 条
              </span>
            )}
          </div>

          <Table
            columns={columns}
            rowKey="eventID"
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys as number[]),
            }}
            {...tableProps}
          />
        </Card>

        <Modal
          open={modalVisible}
          centered
          onCancel={() => {
            setModalVisible(false);
          }}
          okText
          closable={false}
          width={800}
          footer={
            <>
              {modalContext?.resolved === false && (
                <Button
                  type="primary"
                  onClick={async () => {
                    await handleCheck(modalContext.eventID);
                  }}
                  loading={checkLoading}
                >
                  处理
                </Button>
              )}
              <Button
                onClick={() => {
                  setModalVisible(false);
                }}
              >
                关闭
              </Button>
            </>
          }
        >
          {modalContext != null && (
            <Descriptions title="报警记录详情" bordered column={2}>
              <Descriptions.Item label="记录ID">
                {modalContext.eventID}
              </Descriptions.Item>
              <Descriptions.Item label="报警类型">
                {modalContext.alarmRule.alarmRuleName}
              </Descriptions.Item>
              <Descriptions.Item label="报警时间">
                {modalContext.alarmTime}
              </Descriptions.Item>
              <Descriptions.Item label="报警源摄像头名称">
                {modalContext.cameraName}
              </Descriptions.Item>
              <Descriptions.Item label="摄像头型号">
                {modalContext.cameraModel}
              </Descriptions.Item>

              <Descriptions.Item label="状态">
                {modalContext.resolved ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    已处理
                  </Tag>
                ) : (
                  <Tag icon={<ExclamationCircleOutlined />} color="warning">
                    未处理
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="经纬度位置" span={2}>
                {modalContext.cameraLatlng[0]}
                <br />
                {modalContext.cameraLatlng[1]}
              </Descriptions.Item>
              <Descriptions.Item label="报警图片" span={2}>
                <img
                  src={modalContext.alarmPicUrl}
                  alt="报警图片"
                  style={{ width: '100%' }}
                />
              </Descriptions.Item>
            </Descriptions>
          )}
        </Modal>
      </div>
    </Spin>
  );
};
export default observer(Alarms);
