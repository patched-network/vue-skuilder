This directory is a copy-paste of the `src` directory from [chessground](https://github.com/NiloCK/chessground/tree/1cdb4dbb030ecc57a869df86750184e572935e91), with modifications to:
1. replace `white` and `black` as css classes with `cg-white` and `cg-black`
2. demodernize the typescript / javascript, so that the contents are compatible with the local build process

`1.` is necessary because the `white` and `black` css classes collided in unpleasant ways with class names from 

`2.` is necessary because the local build chain is difficult to upgrade.
