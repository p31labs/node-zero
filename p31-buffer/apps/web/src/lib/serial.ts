class HardwareBridge {
  public isConnected: boolean = false;
  private totemResolvers: ((value: boolean) => void)[] = [];

  async transmit(data: string) {
    // a mock of the transmit function
    console.log(`Transmitting: ${data}`);
    return Promise.resolve();
  }

  async requestTotemAuth(promptText: string): Promise<boolean> {
    if (!this.isConnected) return false;
    await this.transmit(`REQ:${promptText}`);
    await this.transmit(`VLT:10.0`); // Arm hardware voltage for the switch

    return new Promise((resolve) => {
      this.totemResolvers.push(resolve);
      setTimeout(() => {
        const index = this.totemResolvers.indexOf(resolve);
        if (index > -1) {
          this.totemResolvers.splice(index, 1);
          resolve(false); // timeout = denied
        }
      }, 15000); // 15s race condition timeout
    });
  }

  simulateTotemPress() {
    const resolve = this.totemResolvers.shift();
    if (resolve) resolve(true);
  }
}

const NodeOne = new HardwareBridge();
export default NodeOne;
