Component({
  options: {
    styleIsolation: 'apply-shared',
  },
  properties: {
    count: { type: Number, value: 0 },
    label: { type: String, value: '' },
    status: { type: String, value: '' },
    symbol: { type: String, value: '' },
  },
  methods: {
    onTap(): void {
      this.triggerEvent('action', {
        label: this.data.label,
        status: this.data.status,
      });
    },
  },
});
