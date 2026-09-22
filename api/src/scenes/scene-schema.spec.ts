import { BadRequestException } from '@nestjs/common';
import { entryMetadata, templateData, validateFields } from './scene-schema';

const field = {
  id: 'score',
  key: 'score',
  label: '评分',
  type: 'rating',
  required: true,
  min: 1,
  max: 5,
};

describe('Scene schema boundaries', () => {
  it('accepts a bounded field and its metadata', () => {
    expect(
      templateData({
        name: '阅读',
        fieldSchema: [field],
        triggers: ['manual'],
        allowedViews: ['heatmap', 'list'],
      }).name,
    ).toBe('阅读');
    expect(entryMetadata({ score: 4 }, validateFields([field]))).toEqual({
      score: 4,
    });
  });

  it('rejects unknown template keys and executable schema properties', () => {
    expect(() => templateData({ name: '阅读', userId: 'other' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateFields([{ ...field, expression: 'process.exit()' }]),
    ).toThrow(BadRequestException);
  });

  it('rejects unvalidated metadata and missing required fields', () => {
    const fields = validateFields([field]);
    expect(() => entryMetadata({}, fields)).toThrow(BadRequestException);
    expect(() => entryMetadata({ score: 6 }, fields)).toThrow(
      BadRequestException,
    );
    expect(() => entryMetadata({ score: 4, arbitrary: true }, fields)).toThrow(
      BadRequestException,
    );
  });
});
