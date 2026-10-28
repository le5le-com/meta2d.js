import localforage from 'localforage';
const METADATA_KEY = '__file_metadata__';

export function initStorage() {
  localforage.config({
    driver: localforage.INDEXEDDB,
    name: 'le5le-meta2d',
  });
}

export interface FileMetadata {
  name: string;
  updateTime: number;
}

// 文件存储结构
interface FileStorage {
  data: string;
  thumbnail?: Blob;
}

// 获取或初始化元数据索引
export async function getMetadata(): Promise<FileMetadata[]> {
  const metadata = (await localforage.getItem<FileMetadata[]>(METADATA_KEY)) || [];
  if (!metadata.length) {
    const keys = (await localforage.keys()).filter((key) => key !== METADATA_KEY);
    const metadata = keys.map((key) => ({ name: key, updateTime: Date.now() }));
    localforage.setItem(METADATA_KEY, metadata);
    return metadata;
  }
  return metadata;
}

// 更新文件的元数据
async function updateFileMetadata(name?: string, oldName?: string) {
  const metadata = (await localforage.getItem<FileMetadata[]>(METADATA_KEY)) || [];

  if (oldName) {
    const index = metadata.findIndex((item) => item.name === oldName);
    if (index !== -1) {
      metadata.splice(index, 1);
    }
  }
  if (name) {
    metadata.unshift({
      name,
      updateTime: Date.now(),
    });
  }
  await localforage.setItem(METADATA_KEY, metadata);
}

export async function listFile(metadata: FileMetadata[]) {
  try {
    const files = await Promise.allSettled(
      metadata.map(async (item) => {
        return await localforage.getItem(item.name);
      })
    );
    return files.map((file) => file.status === 'fulfilled' ? file.value : null);
  } catch (error) {
    console.error('Failed to list files:', error);
    return [];
  }
}


export async function getFile(name: string): Promise<string | null> {
  const fileStorage = await localforage.getItem<FileStorage>(name);
  return fileStorage?.data ?? null;
}

export async function existFile(name: string) {
  const metadata = await getMetadata();
  return metadata.some((item) => item.name === name);
}

export async function addFile(name: string, data: string, overwrite?: boolean, thumbnail?: Blob) {
  if (!overwrite && (await existFile(name))) {
    return '存在同名文件';
  }

  localforage.setItem(name, { data, thumbnail });
  await updateFileMetadata(name);
}

export async function updateFile(name: string, data: string, oldName?: string, thumbnail?: Blob) {
  if (oldName && oldName != name) {
    localforage.removeItem(oldName);
  }
  localforage.setItem(name, { data, thumbnail });
  await updateFileMetadata(name, oldName);
}

export async function deleteFile(name: string) {
  localforage.removeItem(name);
  await updateFileMetadata(undefined, name);
}
