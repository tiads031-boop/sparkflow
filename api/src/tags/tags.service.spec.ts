import { BadRequestException, ConflictException } from '@nestjs/common';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  it('creates normalized user-owned metadata', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'tag-1', name: '学习' });
    const service = new TagsService({
      tag: { findFirst: jest.fn(), create },
    } as never);

    await service.create('user-1', { name: '  #学习  ', color: '#CAE393' });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', name: '学习', color: '#cae393' }),
    });
  });

  it('rejects a third hierarchy level', async () => {
    const service = new TagsService({
      tag: { findFirst: jest.fn().mockResolvedValue({ id: 'child', parentId: 'root' }) },
    } as never);

    await expect(service.create('user-1', { name: '三级', parentId: 'child' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps duplicate names to a user-facing conflict', async () => {
    const service = new TagsService({
      tag: {
        findFirst: jest.fn(),
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
    } as never);

    await expect(service.create('user-1', { name: '阅读' }))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
