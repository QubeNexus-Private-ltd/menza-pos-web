import { apiClient } from '@shared/core/network/apiClient';

export class WebImageUploadService {
  static async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('File', file, file.name);

    const response = await apiClient.post('/Image/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const data = response.data;
    const url = data?.imageUrl || data?.url || data?.blobUrl || data?.data?.imageUrl || data?.data?.url || '';
    if (!url) {
      throw new Error('Image upload response did not include a valid image URL.');
    }
    return url;
  }
}
