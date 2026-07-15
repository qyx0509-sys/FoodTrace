Component({
  options: {
    styleIsolation: 'apply-shared',
  },
  properties: {
    actionLabel: { type: String, value: '' },
    description: { type: String, value: '' },
    title: { type: String, value: '' },
    variant: { type: String, value: 'plate' },
  },
  methods: {
    onAction(): void {
      this.triggerEvent('action');
    },
  },
});
