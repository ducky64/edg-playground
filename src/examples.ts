export const KEYBOARD =  `\
from edg import *


class Keyboard(SimpleBoardTop):
    def contents(self) -> None:
        super().contents()

        self.usb = self.Block(UsbCReceptacle())
        self.reg = self.Block(LinearRegulator(3.3 * Volt(tol=0.05)))
        self.connect(self.usb.gnd, self.reg.gnd)
        self.connect(self.usb.pwr, self.reg.pwr_in)

        with self.implicit_connect(
            ImplicitConnect(self.reg.pwr_out, [Power]),
            ImplicitConnect(self.reg.gnd, [Common]),
        ) as imp:
            self.mcu = imp.Block(IoController())
            self.connect(self.usb.usb, self.mcu.usb.request())

            self.sw = self.Block(SwitchMatrix(ncols=3, nrows=4))
            self.connect(self.sw.cols, self.mcu.gpio.request_vector("sw_col"))
            self.connect(self.sw.rows, self.mcu.gpio.request_vector("sw_row"))

            self.enc = imp.Block(DigitalRotaryEncoder())
            self.connect(self.enc.a, self.mcu.gpio.request("enc_a"))
            self.connect(self.enc.b, self.mcu.gpio.request("enc_b"))
            self.connect(self.enc.with_mixin(DigitalRotaryEncoderSwitch()).sw, self.mcu.gpio.request("enc_sw"))

    def refinements(self) -> Refinements:
        return super().refinements() + Refinements(
            class_refinements=[
                (IoController, Stm32f103),
                (Switch, KailhSocket),
            ])

compile_block(Keyboard)
`
