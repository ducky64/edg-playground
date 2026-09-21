const KEYBOARD =  `\
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

    def refinements(self) -> Refinements:
        return super().refinements() + Refinements(
            class_refinements=[
                (IoController, Stm32f103),
                (Switch, KailhSocket),
            ])

compile_block(Keyboard)
`

const FULL_KEYBOARD =  `\
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

            self.oled = imp.Block(Er_Oled_096_1_1())
            # use I2C because this chip only has one SPI which is used for NPX
            (self.i2c_pull,), _ = self.chain(self.mcu.i2c.request("i2c"), imp.Block(I2cPullup()), self.oled.i2c)
            self.connect(self.mcu.gpio.request("oled_rst"), self.oled.reset)

        # Vbus 5v DOMAIN
        with self.implicit_connect(
            ImplicitConnect(self.usb.pwr, [Power]),
            ImplicitConnect(self.usb.gnd, [Common]),
        ) as imp:
            sw_npx = self.sw.with_mixin(SwitchMatrixNeopixels())
            self.connect(self.usb.gnd, sw_npx.npx_gnd)
            self.connect(self.usb.pwr, sw_npx.npx_pwr)
            (self.npx_shift,), _ = self.chain(self.mcu.gpio.request("npx"), imp.Block(L74Ahct1g125()), sw_npx.npx_din)


    def refinements(self) -> Refinements:
        return super().refinements() + Refinements(
            class_refinements=[
                (IoController, Ch32v203),
                (Switch, KailhSocket),
                (Neopixel, Sk6812Mini_E),
            ],
            instance_values=[
                (
                    ["mcu", "pin_assigns"],
                    [
                        "enc_a=9",
                        "enc_b=8",
                        "enc_sw=7",
                        "npx=28",  # MOSI pin, don't use other SPI pins 26 and 27
                        "i2c.scl=29",
                        "i2c.sda=30",
                        "oled_rst=15",
                        "sw_row_0=20",
                        "sw_row_1=19",
                        "sw_col_0=18",
                        "sw_row_2=13",
                        "sw_col_1=12",
                        "sw_row_3=11",
                        "sw_col_2=10",
                    ],
                )
            ],
            class_values=[
                # assume LEDs not run at full power to satisfy current limit checks
                (Sk6812Mini_E, ["pwr", "current_draw"], Range(0.001, 0.030)),
            ]
        )

compile_block(Keyboard)
`

const USB_UART = `\
from edg import *


class UartConnector(Connector, Block):
    """UART connector, follows the TXD, RXD, GND, +5 pinning of cheap CP2102 dongles."""

    def __init__(self, *, pwr_current_draw: RangeLike = (0, 0) * mAmp):
        super().__init__()
        self.gnd = self.Port(Ground(), [Common])
        self.pwr = self.Port(VoltageSink(current_draw=pwr_current_draw), [Power])
        self.uart = self.Port(UartPort(), [InOut])

        # note that RX and TX here are from the connected device, so they're flipped from the CP2102's view
        self.conn = self.Block(PassiveConnector()).connected(
            {"3": self.gnd, "4": self.pwr, "1": self.uart.rx, "2": self.uart.tx}
        )


class UsbUart(JlcBoardTop):
    def contents(self) -> None:
        super().contents()
        self.usb_uart = self.Block(UsbCReceptacle())

        self.vusb = self.connect(self.usb_uart.pwr)
        self.gnd = self.connect(self.usb_uart.gnd)

        # 5v DOMAIN
        with self.implicit_connect(
            ImplicitConnect(self.vusb, [Power]),
            ImplicitConnect(self.gnd, [Common]),
        ) as imp:
            self.usbconv = imp.Block(Cp2102())
            self.connect(self.usb_uart.usb, self.usbconv.usb)
            (self.led,), _ = self.chain(self.usbconv.nsuspend, imp.Block(IndicatorLed(Led.White)))

            # for target power only
            self.reg_3v3 = imp.Block(LinearRegulator(output_voltage=3.3 * Volt(tol=0.05)))
            self.v3v3 = self.connect(self.reg_3v3.pwr_out)

        # 3v3 DOMAIN
        with self.implicit_connect(
            ImplicitConnect(self.v3v3, [Power]),
            ImplicitConnect(self.gnd, [Common]),
        ) as imp:
            self.out = imp.Block(UartConnector())
            self.connect(self.usbconv.uart, self.out.uart)

    def refinements(self) -> Refinements:
        return super().refinements() + Refinements(
            instance_refinements=[
                (["out", "conn"], PinHeader254),
                (["reg_3v3"], Ap2204k),
            ],
        )

compile_block(UsbUart)
`

const CHARLIE_MATRIX = `\
from edg import *


class LedMatrix(JlcBoardTop):
    def contents(self) -> None:
        super().contents()

        self.usb = self.Block(UsbCReceptacle())

        self.vusb = self.connect(self.usb.pwr)
        self.gnd = self.connect(self.usb.gnd)

        # POWER
        with self.implicit_connect(
            ImplicitConnect(self.vusb, [Power]),
            ImplicitConnect(self.gnd, [Common]),
        ) as imp:
            self.reg_3v3 = imp.Block(LinearRegulator(output_voltage=3.3 * Volt(tol=0.05)))
            self.v3v3 = self.connect(self.reg_3v3.pwr_out)

        # 3V3 DOMAIN
        with self.implicit_connect(
            ImplicitConnect(self.v3v3, [Power]),
            ImplicitConnect(self.gnd, [Common]),
        ) as imp:
            self.mcu = imp.Block(IoController())

            # maximum current draw that is still within the column sink capability of the ESP32
            self.matrix = imp.Block(CharlieplexedLedMatrix(6, 5, current_draw=(3.5, 5) * mAmp, color=Led.Yellow))
            self.connect(self.mcu.gpio.request_vector("led"), self.matrix.ios)

    def refinements(self) -> Refinements:
        return super().refinements() + Refinements(
            instance_refinements=[
                (["mcu"], Esp32c3_Wroom02),
                (["reg_3v3"], Ldl1117),
            ],
            instance_values=[
                (
                    ["mcu", "pin_assigns"],
                    [
                        "led_0=3",
                        "led_1=4",
                        "led_2=5",
                        "led_3=6",
                        "led_4=17",
                        "led_5=15",
                        "led_6=10",
                    ],
                ),
            ],
        )

compile_block(LedMatrix)
`

export const EXAMPLES = {
    "Keyboard": KEYBOARD,
    "Loaded Keyboard": FULL_KEYBOARD,
    "USB UART": USB_UART,
    "Charlieplexed LEDs": CHARLIE_MATRIX,
}
