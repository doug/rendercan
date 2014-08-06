#RenderCan

Download the chrome extension: [https://chrome.google.com/webstore/detail/rendercan/enlfmgpmfaibbeoelliknejffljklemg](https://chrome.google.com/webstore/detail/rendercan/enlfmgpmfaibbeoelliknejffljklemg)

A simple way to record a canvas. It will record any canvas elements on the page as well as any svg animations. When finished, all the frames will be downloaded into a single tar file. You can then use these raw images in any way you want. For example, to convert to a movie you can use something like: 

```ffmpeg -r 60 -i canvas-%09d.png out.mp4```

The extension will temporarily override Date and performance.now so that time moves at 60fps constantly so that the output images are always consistent. Note: this can look like your project is animating slowly, but that is just so that the output frames are 60fps. Final note, frames are output on a requestAnimationFrame.

There is a current bug when when the file size gets to >4.6Gb it runs out of temporary storage and stops recording. If someone has ideas on how to fix it please submit a pull request.

Thanks,<br>
:D
