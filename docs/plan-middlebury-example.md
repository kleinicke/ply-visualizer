There is the midlebury stereo benchmark with some small example dataset. I want
to use it to demonstrate this visualizer. on the website
https://vision.middlebury.edu/stereo/data/scenes2014/datasets/ you find multiple
scenes, i'm interested in all "perfect" scenes.

[PARENTDIR] Parent Directory - [ ] Adirondack-imperfect..> 2014-11-03 20:04 72M
[DIR] Adirondack-imperfect/ 2014-09-01 01:29 - [DIR] Adirondack-perfect/
2014-09-01 01:29 - [DIR] Backpack-imperfect/ 2014-09-01 01:29 - [DIR]
Backpack-perfect/ 2014-09-01 01:29 - [DIR] Bicycle1-imperfect/ 2014-09-01
01:29 - [DIR] Bicycle1-perfect/ 2014-09-01 01:29 - [DIR] Cable-imperfect/
2014-09-01 01:29 - [DIR] Cable-perfect/ 2014-09-01 01:29 - [DIR]
Classroom1-imperfect/ 2014-09-01 01:29 - [DIR] Classroom1-perfect/ 2014-09-01
01:29 - [DIR] Couch-imperfect/ 2014-09-01 01:29 - [DIR] Couch-perfect/
2014-09-01 01:29 - [DIR] Flowers-imperfect/ 2014-09-01 01:29 - [DIR]
Flowers-perfect/ 2014-09-01 01:29 - [DIR] Jadeplant-imperfect/ 2014-09-01
01:29 - [DIR] Jadeplant-perfect/ 2014-09-01 01:29 - [DIR] Mask-imperfect/
2014-09-01 01:29 - [DIR] Mask-perfect/ 2014-09-01 01:29 - [DIR]
Motorcycle-imperfect/ 2014-09-01 01:29 - [DIR] Motorcycle-perfect/ 2016-04-27
15:19 - [DIR] Piano-imperfect/ 2014-09-01 01:29 - [DIR] Piano-perfect/
2014-09-01 01:29 - [DIR] Pipes-imperfect/ 2014-09-01 01:29 - [DIR]
Pipes-perfect/ 2014-09-01 01:29 - [DIR] Playroom-imperfect/ 2014-09-01 01:29 -
[DIR] Playroom-perfect/ 2014-09-01 01:29 - [DIR] Playtable-imperfect/ 2014-09-01
01:29 - [DIR] Playtable-perfect/ 2014-09-01 01:29 - [DIR] Recycle-imperfect/
2014-09-01 01:29 - [DIR] Recycle-perfect/ 2014-09-01 01:29 - [DIR]
Shelves-imperfect/ 2014-09-01 01:29 - [DIR] Shelves-perfect/ 2014-09-01 01:29 -
[DIR] Shopvac-imperfect/ 2014-09-01 01:29 - [DIR] Shopvac-perfect/ 2014-09-01
01:29 - [DIR] Sticks-imperfect/ 2014-09-01 01:29 - [DIR] Sticks-perfect/
2014-09-01 01:29 - [DIR] Storage-imperfect/ 2014-09-01 01:29 - [DIR]
Storage-perfect/ 2014-09-01 01:29 - [DIR] Sword1-imperfect/ 2014-09-01 01:29 -
[DIR] Sword1-perfect/ 2014-09-01 01:29 - [DIR] Sword2-imperfect/ 2014-09-01
01:29 - [DIR] Sword2-perfect/ 2014-09-01 01:29 - [DIR] Umbrella-imperfect/
2014-09-01 01:29 - [DIR] Umbrella-perfect/ 2014-09-01 01:29 - [DIR]
Vintage-imperfect/ 2014-09-01 01:29 - [DIR] Vintage-perfect/ 2014-09-01 01:29 -

when you copy the corresponding link you will get to a page which will look like

Index of /stereo/data/scenes2014/datasets/Playtable-perfect

[ICO] Name Last modified Size Description [PARENTDIR] Parent Directory - [DIR]
ambient/ 2014-05-28 08:58 - [TXT] calib.txt 2014-08-31 00:15 213 [IMG]
disp0-n.pgm 2014-05-16 06:56 4.8M [ ] disp0-sd.pfm 2014-05-16 06:56 19M [ ]
disp0.pfm 2014-04-04 08:08 19M [IMG] disp1-n.pgm 2014-05-16 06:56 4.8M [ ]
disp1-sd.pfm 2014-05-16 06:56 19M [ ] disp1.pfm 2014-04-04 08:08 19M [IMG]
im0.png 2014-05-29 16:35 6.1M [IMG] im1.png 2014-05-29 13:49 6.1M [IMG] im1E.png
2014-05-29 13:49 6.1M [IMG] im1L.png 2014-05-29 13:49 6.2M

here you need to download the calib.txt, the disp0.pfm and the im0.png. You can
find an example of the downloaded data at
/Users/florian/Projects/cursor/test_data/dataset/middleburry/Playroom-perfect

I want to have a command select Dataset, then click at middlebury and then have
a selection of all scenes. when i select a scene i didnt have selected in the
past download the three mentioned files and save them cached not accessable for
users somehwere in a vscode cache. if they are already cached use them. use the
pfm file as normal depth image that can be converted to pointclouds. the
img0.png can be applied as image and the calib.txt file can be used as a
calibration file.
