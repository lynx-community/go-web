import { Input, Select } from '@douyinfe/semi-ui';
import type { SwitchSchemaResult } from '../hooks/use-switch-schema';
import s from './index.module.scss';

export type SwitchSchemaProps = Pick<
  SwitchSchemaResult,
  | 'appOptions'
  | 'currentApp'
  | 'onSchemaChange'
  | 'onAppTypeChange'
  | 'currentAppType'
  | 'isSchemaValid'
>;
export const SwitchSchema = ({
  appOptions,
  currentApp,
  onSchemaChange,
  onAppTypeChange,
  currentAppType,
  isSchemaValid,
}: SwitchSchemaProps) => {
  return (
    <div className={s['switch-schema']}>
      <div className={s['switch-schema-select']}>
        <Select
          style={{ width: '120px' }}
          value={currentAppType}
          onChange={(v) => {
            if (typeof v === 'string') onAppTypeChange(v);
          }}
        >
          {appOptions.map((item) => (
            <Select.Option
              style={{ fontSize: '12px' }}
              key={item.key}
              value={item.key}
            >
              {item.name}
            </Select.Option>
          ))}
        </Select>
        <Input
          style={{ marginLeft: '4px' }}
          value={currentApp?.schema ?? ''}
          onChange={onSchemaChange}
          aria-invalid={!isSchemaValid}
          validateStatus={isSchemaValid ? 'default' : 'error'}
        />
      </div>
    </div>
  );
};
