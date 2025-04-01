# ROM
- invaders.zip contains invaders.{e,f,g,h}
- to combine, cat them in reverse order: `cat invaders.{h,g,f,e} > invaders.all`
- to confirm it worked, compare against https://computerarcheology.com/Arcade/SpaceInvaders/Code.html

# how to build
- install vcpkg
    - `cd /D C:\`
    - `git clone https://github.com/microsoft/vcpkg`
    - `cd vcpkg`
    - `.\bootstrap-vcpkg.bat`
- set environment:
```
SET PATH=%PATH%;C:\vcpkg\installed\x64-windows\bin
SET INCLUDE=C:\vcpkg\installed\x64-windows\include
SET LIB=C:\vcpkg\installed\x64-windows\lib
```
- back in this dir:
- execute `cargo build`

# how to run
- execute `cargo run`
