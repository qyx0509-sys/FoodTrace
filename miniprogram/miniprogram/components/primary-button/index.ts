Component({
  options: {
    styleIsolation: 'apply-shared',
  },
  properties: {
    disabled: { type: Boolean, value: false },
    icon: { type: String, value: '' },
    label: { type: String, value: '' },
    loading: { type: Boolean, value: false },
    variant: { type: String, value: 'primary' },
  },
  methods: {
    onTap(): void {
      if (this.data.disabled || this.data.loading) {
        return;
      }
      this.triggerEvent('action');
    },
  },
});
