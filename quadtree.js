

// Quadtree

// Joshua A. Lemli
// joshualemli@gmail.com
// 2018


const QuadtreeNode = function(parentNode,X,Y,idsArray) {
    this.parentNode = parentNode
    this.X = X
    this.Y = Y
    this.splits = false
    this.ids = idsArray
    this.quads = null
}
QuadtreeNode.prototype._split = function() {

    this.quads = []
}
QuadtreeNode.prototype._merge = function() {
    this.quads = null
}
QuadtreeNode.prototype.addId = function(x,y,id) {}
QuadtreeNode.prototype.removeId = function() {}
QuadtreeNode.prototype.retrieve = function() {
    
}


const Quadtree = function(edgeLength,maxDepth,entitiesObjectPointer) {
    this.RootNode = new QuadtreeNode(null, -edgeLength/2, -edgeLength/2, [])
    this.MAX_DEPTH = maxDepth
    this.MAX_EDGE = edgeLength
    this.Entities = entitiesObjectPointer
}
Quadtree.prototype.add = function(x,y,id) {

    return this.hash(x,y)
}
Quadtree.prototype.move = function(xi,yi,xf,yf,id) {}
Quadtree.prototype.remove = function(x,y,id) {}
Quadtree.prototype.retrieve = function(x,y) {}



