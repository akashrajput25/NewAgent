import { useToastStore } from '../stores/toastStore';

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  useToastStore.getState().addToast({ message, type });
}
