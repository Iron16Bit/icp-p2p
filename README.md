# Interactive Code Playgrounds - P2P Collaborative Editors

WIP project. It uses a [patched redbean](https://github.com/Iron16Bit/ICP_redbeanPatch) to make a platform-independant, p2p connection to other ICPs slide decks reproduced using another patched redbean.

## Usage

1. Install dependencies:
    ``` npm install ```
2. Build the project:
    ``` npm run build -- --language full ```
3. Launch the redbean:
    ``` ./dist/base/redbean.com ```
4. Open the ICP slides on the browser at the displayed address. Default is [http://127.0.0.1:8080/?port=3000](http://127.0.0.1:8080/?port=3000)

Ports used by the redbean can be personalized using:
- ``` -p #### ``` : open redbean HTTP server on port #### [default 8080]
- ``` -event #### ``` : open event server on port #### [default 3000]
- ``` -socket #### ``` : open socket server on port #### [default 3030]

## Remarks

The slides must be opened at *127.0.0.1:8080* and not *localhost:8080*, otherwise it is not possible to connect to the redbean due to CORS problems.

At the moment the program only uses a simplistic algorithm for consistency between the editors. This does not perform well when the 2 users write at the same time. Future work will focus on the implementation of a good consistency algorithm.

## Developer Notes

The differences compared to the original ICPs project are:
- The *./src/p2p_utils* folder, containing the redbean and the Javascript files needed for the P2P connection and collaboration
- The *./src/lib/components/CooperationButton.svelte* file, containing the editor component corresponding to the button needed for the P2P connection